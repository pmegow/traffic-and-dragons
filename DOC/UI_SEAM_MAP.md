# UI_SEAM_MAP.md — the ui.js decomposition map (UA17)

Drawn by Fable 2026-07-11 against **ui.js @ v1.260** (3,299 lines, ~150 functions). This is the
*seam map* half of UA17 — **Sonnet executes** file-by-file from this document. The split is
**drift-neutral**: ui.js touches no parser, no memory tier, no prompt construction; nothing here
is on the ⛨ drift surface. (The one thing that looks close — `rebuildNarrativeFromTranscript`
reads the transcript — is a read-only painter and moves verbatim.)

**Courtesy rule from the session plan:** don't land this split the same week as a tag-engine
cutover commit — keep the diffs reviewable.

---

## 0. Ground rules for the executing session (read before moving anything)

1. **Pure moves, zero behavior change.** Every function body is copied byte-identical. No
   renames, no signature changes, no "while I'm here" cleanups — except the ONE flagged UA22 fix
   (§4.3), which gets its **own commit**.
2. **NO IIFE / module wrappers.** The entire codebase runs on file-scope `var` and
   `function` declarations acting as globals. Dozens of inline `onclick="…"` strings
   (`showQuestModal()`, `dropInvItem(...)`, `campLoad(...)`, `_charExportPick(...)`,
   `_removePendingCompanion(...)`, `showCompanionBrowser()`, `restSpells()`, `campNew()`,
   `campCloudPush/Pull(...)`, `campDelete(...)`, `campStartRename(...)`, `showCapabilityCard(...)`,
   `_cbPickLocal/_cbPickLib/_cbDelLib` via `window.`) resolve at global scope. Wrapping a file in
   an IIFE breaks them silently.
3. **Top-level `var`s move with their cluster** and keep their initializers (`=null`, `={...}`).
   None of ui.js's top-level statements cross-reference another ui.js symbol at parse time, so
   file order among the new ui-*.js files is not load-bearing — but keep the order in §3 anyway
   (dependency-suggestive, boot last).
4. **wireButtons stays last-loaded.** `ui-boot.js` is the final ui file in the script list; the
   `window.addEventListener("load", ...)` bootstrap line is its last statement, exactly as today.
5. **One file per commit** (or 2–3 small ones), engine tests + preview smoke between commits.
   Note: `dev/run-tests.js` does **not** load ui.js (headless list ends at game.js), so the split
   cannot break engine tests — the preview smoke in §5 is the real verification.
6. **Bump `APP_VERSION` (globals.js) + `CACHE` (sw.js) on every commit**, per the standing rule.
7. Comments move with their functions, including audit-reference comments (E60, E61, E69, #50…).
   They are the institutional memory of past bugs.

---

## 1. Function → file table

Ten focused files. Line numbers are v1.260 ui.js. Every symbol in ui.js is listed — if the
executing session finds one not listed here, stop and flag it.

### ui-shell.js — toasts, screens, message log (~140 lines)
| Symbol | Lines | Note |
|---|---|---|
| `_reflowToasts` | 199 | |
| `showToast` | 202–215 | called by 8 other files — load this file first |
| `showLoadingModal` | 216–227 | |
| `showGame` | 228–234 | removes creation modals |
| `showChar` | 235–256 | resets wizard state `cs` (char-creation coupling — see §2) |
| `switchTab` | 257 | |
| `addMsg` | 258–267 | Car Mode hook inside (`typeof carMode` guard — stays) |
| `closeAllMenus` | 551 | menu ids only; shared by many modals |

### ui-panels.js — syncUI + the 8 live panels + membar (~200 lines)
| Symbol | Lines |
|---|---|
| `syncUI` | 268 |
| `updateQuestPanel` | 269–284 |
| `updateHUD` | 285–342 (incl. sidebar `sb-content` build + party HUD cards) |
| `updatePartyPanel` | 343–371 |
| `invItemHtml` | 375–390 |
| `updateInvPanel` | 391–398 |
| `updateAbPanel` | 399–403 |
| `updateSpPanel` | 404–423 |
| `updateCombat` | 424–454 |
| `activeModelLabel` | 457–461 |
| `updateMemStatus` | 462 |
| `updateSyncBadge` | 466–481 |

### ui-portrait.js — pan/zoom, drag, compression, the portrait modal (~340 lines)
| Symbol | Lines | Note |
|---|---|---|
| `normPortraitOff` | 8–13 | |
| `applyPortraitTransform` | 16–27 | |
| `_pdActive`, `_pdDocWired`, `_pdEnsureDoc` | 34–39 | E61 shared drag dispatch — vars move together |
| `wirePortraitDrag` | 40–66 | called by char-creation.js too |
| `portraitRenderBody` | 69 | called by char-creation.js |
| `compressPortrait` | 187–198 | called by char-creation.js + game.js |
| `showPortraitModal` | 1143–1392 | async; the fal.ai portrait-gen sub-app (UA21 dup #2, §4.2) |

### ui-files.js — campaign folder, filenames, save/blueprint/narrative export-import (~340 lines)
| Symbol | Lines | Note |
|---|---|---|
| `_campFolderHandle` | 1 | top-level var |
| `_campRootHandle`, `_SUBFOLDERS` | 71–72 | |
| `buildFilename` | 73–86 | called by game.js (doRender) |
| `exportToFolder` | 87–105 | called by game.js |
| `_slugFolderName` | 106 | |
| `_openCampaignSubfolder` | 107–115 | |
| `setCampaignFolder` | 116–124 | |
| `initCampaignFolderForGame` | 125–133 | called by game.js (startGame) |
| `_collectDirEntries`, `_copyDir` | 134–157 | |
| `renameCampaignFolder` | 158–173 | called by campSaveRename (ui-campaigns) |
| `clearCampaignFolder` | 174–178 | |
| `updateCampFolderUI` | 179–186 | writes File-menu button state (ids exist after buildFileMenus) |
| `buildNarrativeHtml` | 660–702 | pure ws→string; local `esc` fallback is UA21 dup #4 |
| `exportNarrativeHtml` | 703–708 | |
| `exportSave` | 709–748 | |
| `exportBlueprint` | 752–797 | |
| `importSave` | 798–826 | |

### ui-sheets.js — character/NPC sheet rendering + sheet actions (~620 lines)
| Symbol | Lines | Note |
|---|---|---|
| `csSec`, `csKv`, `csInitials`, `csHeroHeader` | 990–1000 | shared cs-* builders |
| `dropInvItem` | 1004–1017 | inline-onclick target — must stay global |
| `csSheetSections` | 1020–1061 | ONE renderer, three hosts (player/NPC/read-only) |
| `showCapabilityCard` | 1065–1074 | #10 click-card; inline-onclick target |
| `csWireToggles` | 1075 | |
| `showCharSheet` | 1077–1142 | PC avatar wiring — UA22 divergence lives here (§4.3) |
| `generateNpcSheet` | 1393–1460 | async; callGM JSON sheet generation |
| `partWaysWithCompanion` | 1464–1476 | |
| `showNpcSheet` | 1477–1644 | NPC avatar wiring incl. E60 fallback (§4.3) |
| `_switchPlayerCharacter` | 2108–2143 | launched from the NPC sheet's ▶ button |
| `showReadOnlyCharSheet` | 2302–2339 | library snapshot viewer |

### ui-browsers.js — character/blueprint/companion browsers + character I/O (~800 lines)
| Symbol | Lines | Note |
|---|---|---|
| `_applyBlueprint` | 827–838 | |
| `clearBlueprint` | 839–843 | |
| `showBlueprintBrowser` | 844–988 | segBtn/render/wireSegs copy #1 (UA21, §4.2) |
| `showCharacterBrowser` | 1646–1801 | segBtn copy #2; defines `window._cbPickLocal/_cbPickLib/_cbDelLib` |
| `showCharImportPreview` | 1803–1852 | |
| `_doExportChar` | 2066–2073 | |
| `exportCharacter` | 2074–2103 | sets `window._charExportList` |
| `_charExportPick` | 2104–2107 | inline-onclick target |
| `_importCharToReview` | 2147–2161 | |
| `_startImportedCampaign` | 2162–2207 | |
| `_addImportedCompanion` | 2208–2224 | |
| `importCharacterFile` | 2225–2243 | |
| `_charLibSlug` | 2245 | |
| `_showCharExportOptions` | 2247–2276 | launched from char sheet + NPC sheet (ui-sheets) |
| `_showCharOverwriteConfirm` | 2278–2295 | |
| `showCharacterLibrary` | 2298 | one-liner alias |
| `_renderCompanionSlots` | 2341–2364 | called by char-creation.js (Review step) |
| `_addPendingCompanion`, `_removePendingCompanion` | 2365–2376 | inline-onclick targets |
| `showCompanionBrowser` | 2377–2489 | segBtn copy #3 (UA21) |

### ui-campaigns.js — campaign picker, camp CRUD, cloud push/pull, server connect (~360 lines)
| Symbol | Lines | Note |
|---|---|---|
| `TND_SERVER_URL` | 520 | top-level var |
| `updateServerUI` | 522–538 | menu-triple enumeration (UA21 dup #5) |
| `clearCacheAndReload` | 540–550 | SW unregister + reload |
| `connectToServer` | 553–572 | E33 local-only push logic |
| `campCloudPushSilent` | 573–605 | v1.240 parseWorldState comment MUST move with it |
| `disconnectFromServer` | 607–612 | |
| `showCampaignPicker` | 1854–1870 | |
| `_showCampaignPickerModal` | 1871–1899 | |
| `_renderCampList` | 1900–1935 | inline-onclick targets campLoad/campDelete/etc. |
| `_applyLoadedCampaign` | 1936–1944 | |
| `campLoad` | 1945–1974 | |
| `campCloudPush` | 1975–1983 | |
| `campCloudPull` | 1984–2018 | E3 pull-into-live-keys comment moves with it |
| `campDelete` | 2019–2026 | |
| `campStartRename`, `campSaveRename` | 2027–2054 | calls renameCampaignFolder (ui-files) |
| `campNew` | 2055–2064 | |

### ui-carmode.js — the Car Mode overlay (~185 lines)
| Symbol | Lines |
|---|---|
| `_carKbHandler` | 2491 (top-level var) |
| `showCarMode`, `hideCarMode` | 2493–2530 |
| `_carUpdate`, `_carUpdateParty` | 2532–2561 (party render copy #3 — UA21) |
| `_carSetStatus`, `_carSyncBtn`, `_carPulse` | 2563–2592 |
| `_carTap`, `_carNext`, `_carPrev` | 2594–2634 |
| `_carStartMic`, `_carAutoMic`, `_carMediaSession` | 2636–2671 |

### ui-modals.js — settings & utility modals (~470 lines)
| Symbol | Lines | Note |
|---|---|---|
| `showRulesModal`, `removeRule` | 482–498 | |
| `FONT_KEY`, `loadFontSize`, `toggleFontSize` | 499–513 | menu-triple enumeration (UA21 #5) |
| `toggleAdultMode`, `loadAdultMode` | 514–515 | ″ |
| `loadLegacySettings`, `saveLegacySettings` | 516–517 | ″ |
| `showSyncModal` | 614–654 | direct world-state editor |
| `loadFalKey`, `loadRenderModel` | 2947–2951 | |
| `showRenderOptionsModal` | 2952–3024 | #42 strength slider |
| `saveProviderSettings` | 3028–3033 | |
| `showProviderModal` | 3034–3079 | E88 staged-key logic |
| `showUsageModal` | 3084–3121 | #21 telemetry + UA5 cache-health line |
| `showRagModal` | 3125–3149 | |
| `loadProseAuthor`, `showProseModal` | 3151–3180 | |
| `showQuestModal`, `acceptQuest`, `declineQuest` | 3182–3229 | E24 wire-by-title comments move with them |

### ui-boot.js — file menus, wiring, bootstrap (~430 lines) — **LOADS LAST**
| Symbol | Lines | Note |
|---|---|---|
| `buildFileMenus` | 2682–2751 | the v1.159 one-spec menu generator |
| `resetFileSubmenus` | 2754–2758 | |
| `wireButtons` | 2759–2946 | calls buildFileMenus first; stays intact as ONE function |
| `submitKey` | 3230 | |
| `initSettings` | 3231–3235 | |
| `rebuildNarrativeFromTranscript` | 3244–3263 | read-only transcript painter (v1.240 warn stays verbatim) |
| `initReplaySession` | 3264–3284 | |
| `initState` | 3285–3297 | |
| `init` | 3298 | |
| `window.addEventListener("load", …)` | 3299 | the LAST statement of the last file |

---

## 2. Per-file dependency profile

All ui functions read/write the same global pool; this section lists what each file *needs to
exist* (definitions come from earlier scripts in the load order) and *who calls into it* — so a
reviewer can sanity-check a move without re-reading everything.

| New file | Globals/state it reads or writes (beyond `document`) | Functions it calls in OTHER files | Called into from |
|---|---|---|---|
| **ui-shell.js** | `cs`, `rvGoldRolled`, `pendingImportChar`, `pendingBlueprint`, `pendingCompanions`, `activeChatTab`, `carMode` | `buildDots`, `buildDnaStep` (char-creation.js, from `showChar`); `TTS.speak` (tts.js, guarded); `_carSetStatus`/`_carSyncBtn` (ui-carmode, guarded via `typeof carMode`) | `showToast`: state.js, storage-adapter.js, tag_table.js, api.js, char-creation.js, game.js, tts.js, stt.js. `addMsg`: memory.js, api.js, game.js, storage-adapter.js. `showGame`: game.js, storage-adapter.js. `showChar`: game.js |
| **ui-panels.js** | `worldState`, `memory`, `XP_LEVELS`, `SUMMARIZE_AT`, `APP_VERSION`, `PROVIDERS`, `activeProvider`, `providerModels`, `sessionTokens` (memory.js), `storageAdapter.syncStatus`, `escHtml` (helpers.js) | `showNpcSheet`, `showCharSheet` (ui-sheets); `showQuestModal` (ui-modals); `skillLevel`, `smod` (helpers.js); `restSpells` (game.js, via inline onclick) | `syncUI`: api.js, game.js, storage-adapter.js, tag_table.js. `updateAbPanel`/`updateSpPanel`: game.js. `updateSyncBadge`: storage-adapter.js. `updateMemStatus`/`updateCombat`/`updateHUD`: game.js + siblings |
| **ui-portrait.js** | `busy`, `falKey`, `renderModel`, `RENDER_MODELS`, `worldState` | `callGM` (api.js); `describePortraitImage` (game.js); `storageAdapter.markPortraitDirty`; `saveAll` (state.js); `buildFilename`/`exportToFolder` (ui-files); `showToast` (ui-shell); `img2imgStrength` (helpers.js — only via RENDER_MODELS body fns) | `wirePortraitDrag`/`compressPortrait`/`portraitRenderBody`: char-creation.js. `compressPortrait`: game.js. `showPortraitModal`: ui-sheets (both avatars) |
| **ui-files.js** | `_campFolderHandle`/`_campRootHandle` (own), `worldState`, `sessionLog`, `memory`, `store`, `WSK`, `APP_VERSION`, `AUTHORS`, `pendingBlueprint` | `parseWorldState`/`serializeWorldState`, `migrateWorldState`, `saveAll`, `snapshotActiveCamp`, `getActiveCampId`/`setActiveCampId`/`newCampaignId`, `getCampMeta`/`setCampMeta` (state.js); `buildBlueprintFromGame`, `initAbilities`, `initSpells` (game.js); `storageAdapter.*`; `npcPortrait`, `escHtml` (helpers.js); `showToast`, `showGame`, `addMsg`, `closeAllMenus` (ui-shell); `syncUI`, `updateCombat` (ui-panels); `initReplaySession` (ui-boot); `normalizeBlueprint`/`validateBlueprint` (game.js) | `buildFilename`/`exportToFolder`/`initCampaignFolderForGame`: game.js. `renameCampaignFolder`: ui-campaigns. `exportSave`/`importSave`/`exportBlueprint`/`exportNarrativeHtml`: ui-boot (menu wiring) |
| **ui-sheets.js** | `worldState`, `memory`, `busy`, `STATS`, `SKILLS`, `SKILL_LEVELS`, `XP_LEVELS` | `capabilityLookup`, `bibleCardHTML`, `npcPortrait`, `escHtml`, `smod`, `skillLevel`, `csInitials` (helpers.js/data.js); `callGM` (api.js); `resolveNpcName` (memory.js); `syncCharSheet`, `sendAction`, `pronounsForGender`, `initAbilities`, `initSpells` (game.js); `npcLinkUpsert` (memory.js); `saveAll` (state.js); `showPortraitModal`/`wirePortraitDrag` (ui-portrait); `_showCharExportOptions` (ui-browsers); `showToast`/`showLoadingModal` (ui-shell); `updateInvPanel`/`syncUI` (ui-panels); `storageAdapter.markPortraitDirty` | `showCharSheet`: game.js (syncCharSheet reopen), ui-panels (sidebar/party). `showNpcSheet`: ui-panels (HUD cards, party rows). `csSheetSections`/`csHeroHeader`: ui-sheets internal ×3 hosts. `dropInvItem`/`showCapabilityCard`: inline onclick |
| **ui-browsers.js** | `worldState`, `memory`, `cs`, `pendingCompanions`, `pendingImportChar`, `pendingBlueprint`, `store`, `WSK`, `TONES`, `PARTY_MAX` | `storageAdapter.*` (library/blueprint/server); `getCampMeta`, `getActiveCampId`, `newCampaignId`, `setActiveCampId`, `snapshotActiveCamp`, `blankMemory` (state.js); `startGame`, `goStep`, `rvSyncXp`, `normalizeBlueprint`, `validateBlueprint`, `partyCompanionCount`/`partyCompanionCap`, `sendAction`, `pronounsForGender` (game.js/char-creation.js); `initSkills`, `alignLabel`, `escHtml`, `npcLinkUpsert` (helpers/memory); `showReadOnlyCharSheet` (ui-sheets); `showToast`/`closeAllMenus` (ui-shell); `saveAll`, `syncUI` | `_renderCompanionSlots`: char-creation.js. `_showCharExportOptions`: ui-sheets (both sheets). `showCharacterBrowser`/`importCharacterFile`: ui-boot (menu wiring). `showBlueprintBrowser`: ui-boot + char-creation (step-1 button) |
| **ui-campaigns.js** | `store`, `WSK`/`SLK`/`MEM_KEY`, `worldState`, `sessionLog`, `memory`, `busy` | `storageAdapter.*`; `getCampMeta`/`setCampMeta`, `getActiveCampId`, `newCampaignId`/`setActiveCampId`, `switchToCampaign`, `snapshotActiveCamp`, `deleteCampaign`, `loadState`, `serializeWorldState`/`parseWorldState`, `blankMemory`, `migrateToCampaigns` (state.js); `npcPortrait` (helpers.js); `initAbilities`/`initSpells`, `migratePendingCompanionSheets` (game.js); `showToast`/`addMsg`/`showChar`/`showGame`/`closeAllMenus` (ui-shell); `syncUI`/`updateCombat` (ui-panels); `initReplaySession` (ui-boot); `renameCampaignFolder` (ui-files); `updateServerUI` (own) | `showCampaignPicker`: ui-boot (menus), connectToServer (own). `updateServerUI`: ui-boot (initSettings). `campCloudPushSilent`: campSaveRename (own), connectToServer (own). camp* CRUD: inline onclick from `_renderCampList` |
| **ui-carmode.js** | `carMode`, `busy`, `worldState` | `TTS.*`, `STT.*` (guarded); `showToast` (ui-shell); `escHtml` (helpers.js) | `showCarMode`/`hideCarMode`/`_carTap`/`_carPrev`/`_carNext`: ui-boot (wireButtons). `_carSetStatus`/`_carSyncBtn`: ui-shell (`addMsg` Car hook) |
| **ui-modals.js** | `customRules`, `DEFAULT_RULES`, `adultMode`, `ADK`, `legacyCharsOn`/`legacyChancePct` + keys, `falKey`, `renderModel`, `renderStrength`, `RENDER_MODELS`, `RENDER_MDL_K`/`RENDER_STR_K`/`FAL_KEY_K`, `PROVIDERS`, `activeProvider`, `providerKeys`, `providerModels`, `allowModelUpgrade`, `PROV_K`/`PKEYS_K`/`PMDL_K`/`UPGRADE_K`/`AKK`/`PROSE_K`, `proseAuthor`, `AUTHORS`, `worldState`, `memory`, `store` | `saveRules` (api.js); `img2imgStrength` (helpers.js); `blankUsage`, `saveCore`, `saveAll` (state.js); `loadLegacyLibrary` (game.js, guarded); `showToast` (ui-shell); `syncUI` (ui-panels); `escHtml` | `showQuestModal`: ui-panels (quest rows onclick). `saveProviderSettings`: submitKey (ui-boot). load* settings fns: initSettings + wireButtons (ui-boot). All show*Modal: ui-boot (menu wiring) |
| **ui-boot.js** | everything above + `providerKeys`, `apiKey`, `panelCol`, `secCol`, `_qaSuppressUntil`, `busy`, `APP_VERSION` | `storageAdapter.load/syncNow`; `sendAction`, `rerollLast`, `doRender`, `newGame`, `toFirstPerson`, `buildActionButtons`, `checkLegacyCharacter`, `migratePendingCompanionSheets` (game.js); `goStep`, `rollAllStats`, `confirmChar`, `buildStep6Deity`, `getDefaultDeity`, `refreshFtPortrait`, `ftRenderPortrait`, `ftDeriveAppearance`, `aiRandomiseAll`, `injectSparkleButtons`, `buildReview`, `hideAncDetail`, `buildDots` (char-creation.js); `cleanTxt`, `diceTxt`, `parseActions` (api.js); `escProse`/`escHtml` (helpers.js); `TTS.*`/`STT.*`; `loadProviderSettings` (state.js); nearly every show* in the other ui files (menu wiring table) | `rebuildNarrativeFromTranscript`: storage-adapter.js (server reconcile). `initReplaySession`: ui-files (importSave), ui-campaigns (_applyLoadedCampaign). `init`: submitKey (own), load listener (own) |

**Wizard-coupling note:** `showChar` (ui-shell) resets the char-creation wizard (`cs`, step
classes, `buildDots`/`buildDnaStep`). That coupling exists today and moves as-is; do NOT try to
relocate it into char-creation.js during this pass.

---

## 3. index.html script order + sw.js APP_SHELL

### index.html (lines 396–410 today) — replace the single `ui.js` tag with:

```html
<script src="globals.js"></script>
<script src="compress.js"></script>
<script src="data.js"></script>
<script src="capability_bible.js"></script>
<script src="helpers.js"></script>
<script src="state.js"></script>
<script src="storage-adapter.js"></script>
<script src="memory.js"></script>
<script src="tag_table.js"></script>
<script src="api.js"></script>
<script src="char-creation.js"></script>
<script src="game.js"></script>
<script src="ui-shell.js"></script>
<script src="ui-panels.js"></script>
<script src="ui-portrait.js"></script>
<script src="ui-files.js"></script>
<script src="ui-sheets.js"></script>
<script src="ui-browsers.js"></script>
<script src="ui-campaigns.js"></script>
<script src="ui-carmode.js"></script>
<script src="ui-modals.js"></script>
<script src="ui-boot.js"></script>
<script src="tts.js"></script>
<script src="stt.js"></script>
```

`tts.js`/`stt.js` stay after the ui files exactly as they follow ui.js today (stt.js binds to
menu-checkbox ids that `buildFileMenus` creates at `wireButtons` time, i.e. on window load — no
parse-time dependency, but don't reorder).

### sw.js — APP_SHELL: replace `"/ui.js"` with the ten entries

```js
  "/ui-shell.js",
  "/ui-panels.js",
  "/ui-portrait.js",
  "/ui-files.js",
  "/ui-sheets.js",
  "/ui-browsers.js",
  "/ui-campaigns.js",
  "/ui-carmode.js",
  "/ui-modals.js",
  "/ui-boot.js",
```

and **bump `CACHE`** in the same commit (hard rule — cache-first SW; a stale shell would load
index.html referencing files the old cache doesn't have → white screen until manual clear).
Delete `ui.js` from disk only in the FINAL commit of the sequence, after everything is moved and
smoke-tested; until then keep incremental commits shippable by moving whole clusters at a time
(a half-moved file must never be deployed — the SW precaches whatever the commit says).

**During the migration, the safest shape per commit is:** move cluster(s) → add new `<script>`
tag(s) → add APP_SHELL entries → bump CACHE + APP_VERSION → smoke. The old ui.js shrinks each
commit and is removed in the last one.

### CLAUDE.md / docs
The final commit updates CLAUDE.md's file table + script-load-order section (ui.js row → the ten
new rows) and the sw.js APP_SHELL description. Same commit as the ui.js deletion.

---

## 4. Execution notes for the Sonnet session

### 4.1 Suggested move order (dependency-quiet → coupled)
1. **ui-carmode.js** — most isolated cluster; proves the pipeline (script tag, SW, smoke).
2. **ui-portrait.js** — self-contained mechanics + one big modal.
3. **ui-files.js**, **ui-modals.js** — leaf modals and I/O.
4. **ui-panels.js**, **ui-shell.js** — widely-called but internally simple.
5. **ui-sheets.js**, **ui-browsers.js**, **ui-campaigns.js** — the big interlinked trio.
6. **ui-boot.js last** — wireButtons + bootstrap; after this commit ui.js is empty → delete it,
   update CLAUDE.md, final smoke.

### 4.2 UA21 dedup cluster — companion pass, SEPARATE commits after the move completes
Do **not** dedupe while moving (that violates "pure moves"). After the split lands and soaks,
run UA21 as its own pass. The specific duplicates, with post-move homes:

1. **Segmented-control triplet** — `segBtn`/`render`/`wireSegs` re-declared in
   `showBlueprintBrowser` (ui.js:851, 975–987), `showCharacterBrowser` (1691–1695, 1710–1711),
   and `showCompanionBrowser` (2463–2488). All three land in **ui-browsers.js** → extract ONE
   `cbrSegControl(containerId, modes, current, onSwitch)` helper in that file.
2. **Two fal.ai portrait-generation implementations** — `showPortraitModal`'s
   `runGenerate`/`runGenerateWithPrompt` (ui.js:1296–1366, lands in ui-portrait.js) vs the
   wizard's `ftRenderPortrait` path (char-creation.js:96–174). Extract one
   `generatePortraitImage(charDesc, details, refSrc)` in ui-portrait.js; char-creation calls it.
   (Note the near-identical fetch bodies duplicated even WITHIN showPortraitModal — runGenerate
   vs runGenerateWithPrompt differ only by the callGM prompt-writing step.)
3. **Party render ×3** — `updatePartyPanel` (ui-panels), `updateHUD` party HUD cards
   (ui-panels:294–323), `_carUpdateParty` (ui-carmode:2547–2561). Extract one
   `partyMemberVitals(npc)` → `{name, hp, maxHp, pct, color, cls}` data helper (ui-panels.js);
   the three renderers keep their own markup.
4. **Three escapers** — `escHtml` (helpers.js, canonical), `buildNarrativeHtml`'s local `esc`
   fallback (ui.js:661 — keep: it's a deliberate purity guard for a pure function, just add a
   comment), `tts.js` `_escVal` (inside the TTS IIFE — swap to global `escHtml`, it's loaded).
5. **Menu-triple enumeration** — the `["fm-","cs-fm-","api-fm-"]` /
   `["","cs-","api-"]` walks in `loadFontSize`/`toggleFontSize` (507/512),
   `toggleAdultMode`/`loadAdultMode` (514/515), `loadLegacySettings` (516),
   `updateServerUI` (524), `updateCampFolderUI` (180), `closeAllMenus` (551),
   `wireButtons`' checkbox sync blocks (2847–2869), and `stt.js:122`. Extract
   `eachMenuEl(idSuffix, fn)` in ui-shell.js; consumers loop through it.

### 4.3 UA22 — the flagged fix-during-move (ONE deliberate behavior change, own commit)
**Divergence:** the NPC sheet's offset getter has the E60 fallback; the PC sheet's doesn't.

- NPC path (ui.js:1623, moves to ui-sheets.js):
  `wsNpc.portraitOffset || (wsNpc.charSheet && wsNpc.charSheet.portraitOffset) || {x:.5,y:.5,zoom:1}`
- PC path (ui.js:1133, same file):
  `worldState.character.portraitOffset || {x:.5,y:.5,zoom:1}` — no secondary source.

The showCharSheet/showNpcSheet copy-pasta means fixes land on one side only. **Fix while the two
functions sit in one file:** extract a shared accessor pair in ui-sheets.js —

```js
// E60/UA22: ONE offset-resolution rule for both sheet avatars. char is the sheet object
// (worldState.character for the PC, wsNpc.charSheet for a companion); ownerNpc is the
// worldState.npcs entry when one exists (companions), null for the PC.
function sheetOffsetGet(ownerNpc, char){
  return (ownerNpc && ownerNpc.portraitOffset) || (char && char.portraitOffset) || {x:0.5,y:0.5,zoom:1};
}
```

and use it from both `wireAvatarDrag` (PC) and `npcGetOff` (companion). The PC setter is
unchanged. Behavior delta: none for today's PC saves (character.portraitOffset is the only
home), but the rule is now single-sourced so the class of divergence dies — which is exactly how
the audit expected this row to close ("dies naturally in UA17's shared sheet renderer"). Commit
message cites UA22 + audit E60.

### 4.4 Things that look movable but are NOT ui.js's to move
- `saveRules`/`loadRules` live in api.js — `showRulesModal` calls them cross-file (unchanged).
- `buildBlueprintFromGame`, `normalizeBlueprint`, `validateBlueprint` live in game.js (moved
  there v1.156 for headless testability) — ui-files/ui-browsers call them (unchanged).
- `npcPortrait`, `bibleCardHTML`, `escHtml/escProse`, `img2imgStrength` live in helpers.js.
- `loadProviderSettings` lives in state.js (v1.180) — the load listener calls it (unchanged).

### 4.5 Known sharp edges
- **`window.`-attached closures:** `_cbPickLocal`/`_cbPickLib`/`_cbDelLib` are (re)assigned every
  time `showCharacterBrowser` runs and close over that invocation's `modal`/`mode` — they move
  inside the function body untouched.
- **`exportCharacter` → `window._charExportList`:** module-crossing hand-off to
  `_charExportPick`; both stay in ui-browsers.js.
- **`addMsg`'s Car Mode hook** references `_carSetStatus`/`_carSyncBtn` behind a
  `typeof carMode!=="undefined"` guard — fine across files (both global), keep the guard.
- **`showPortraitModal` and `generateNpcSheet` are `async function`s** — the project convention
  allows async only in API-facing functions; these already are. Don't "modernize" anything else.
- **UA18/#22 escHtml sinks:** the enumerated XSS-ish sinks (spell panel nm/ds raw at
  ui.js:413–417 → ui-panels.js; combat statblock immune/resist/vuln at 448–450 → ui-panels.js;
  PC-name `alt='…'` attribute injection at 1094/1127 and the **model-invented NPC name** `alt`
  at 1491/1629 → ui-sheets.js; imported-save name into addMsg at 824 → ui-files.js) move
  VERBATIM in this pass — #22 fixes them afterwards using UA18's list, updated with these new
  file homes.

---

## 5. Verification checklist (preview smoke — engine tests don't cover ui.js)

Run after each commit (quick pass = items marked ●); run the FULL list before deleting ui.js and
again on the deployed Cloudflare page after push. Test with a real mature campaign import (a
`.tnd` export) plus a fresh wizard character.

**Boot & shell**
- ● Hard-refresh loads with ZERO console errors (a single missing global kills every later
  `wireButtons` binding — this is THE regression signature for this refactor).
- ● API screen → key submit → game boots; "Welcome back" + transcript replay paints (last ~20
  entries, "earlier entries omitted" note on a long save).
- ● A toast appears and dismisses on tap (any action that toasts).

**Panels (ui-panels)**
- ● Send one cheap turn: HUD updates (HP/gold/XP pulse), inventory/abilities/spells panels
  refresh, membar shows `~Ntk | … | APP_VERSION | model`.
- Combat save: `#cpanel` visible with statblock; non-combat save: hidden.
- Sidebar (World state) opens; party buttons open the right sheets; quest rows open the journal.

**Sheets (ui-sheets)**
- Sheet button → player char sheet: sections toggle, spell/ability names open the capability
  card, inventory drop × works (confirm → toast → sheet re-renders), ⟳ Sync runs.
- Party member card → NPC sheet: Status/Profile/History render; Generate/Regenerate sheet;
  Part ways (confirm flow); ▶ Play-as (confirm flow) swaps PC and sends the silent handoff.
- Portrait: drag-to-pan + wheel zoom on BOTH avatars; edit modal opens for both; companion
  offset edit does NOT move the player's framing (the v1.43 regression).
- Read-only sheet from the library renders with no drop × buttons.

**Portrait modal (ui-portrait)**
- Upload → preview → Apply sets portrait (compressed). With a fal key: Generate and Update
  (img2img) paths; Edit Prompt → Regenerate; Describe-from-image writes appearance.

**Files & campaigns (ui-files / ui-campaigns)**
- Save Game modal → file lands (folder set AND unset paths); Export Narrative produces the
  chronicle HTML; Export as Blueprint modal; Export/Import Character round-trips a `.char`.
- Import Save (.tnd) → story pane repaints, no duplicate campaign slot (campId reuse).
- Campaigns picker: list renders, Load (local AND cloud-only), rename (persists + folder
  renames), delete, New Campaign → wizard.
- Server: Connect (OAuth popup) → campaign list merge → picker; disconnect; sync badge appears
  when the server is unreachable.

**Browsers (ui-browsers)**
- Import Character browser: Library/Local tabs switch, row → read-only sheet → Import →
  preview → "Play as" flow reaches the campaign-setup modal; "+ Add as companion" mid-game
  sends the silent intro.
- Blueprint browser: Local file import → preview (acts/NPCs spoiler toggles) → Use; Library
  list + delete.
- Wizard Review step: companion slots render, Add companion browser, remove ×.

**Menus & modals (ui-boot / ui-modals)**
- ● All three File menus open, every drawer flies out (desktop) / accordions (≤768px), version
  line shows APP_VERSION in all three.
- Each Admin modal opens and saves: Voice Settings, Narrative rules (add/remove custom rule),
  Prose inspiration, Language Model (provider switch + staged keys), Usage & cost (+ reset),
  Episodic memory toggle, Render Options (model pick + strength slider), Large text, legacy
  toggles, campaign folder set/clear.
- Sync modal: Game→UI shows live values; UI→Game APPLY mutates and syncs.
- Quest journal: Accept/Decline on an offered quest.

**Car Mode (ui-carmode)**
- Opens from the menu, tap/next/prev respond, Esc closes, keyboard handler detaches (no double
  handlers after reopen).

**Service worker / deploy**
- After push: deployed site loads the NEW version (membar APP_VERSION), DevTools →
  Application → Cache Storage shows the new CACHE name containing all ten ui-*.js files;
  offline reload still boots.

**Suggested actions & reload persistence**
- ● Action buttons appear after a turn; tap fills input, long-press sends; reload restores the
  last buttons (`worldState.lastActions`).
