# Traffic and Dragons — CLAUDE.md

## Project overview

**Traffic and Dragons** is a browser-based sword & sorcery RPG. The player creates a character through a multi-step wizard, then plays a text adventure narrated by Claude (via the Anthropic API) acting as the Game Master. The GM responds in vivid second-person prose, tracks the world state through hidden tags embedded in its responses, and maintains a rolling memory of NPCs, locations, lore, and decisions across sessions.

There is no build step and no npm dependencies. There is a cloud sync server on Fly.dev (`https://traffic-and-dragons-server.fly.dev`) — optional, used for cross-device campaign persistence.

**This file holds current contracts only.** Version-by-version evolution, incident stories, and measured evidence live in [DOC/CLAUDE_HISTORY.md](DOC/CLAUDE_HISTORY.md) — when a contract here earns a war story, the story goes there and the contract line links to it.

---

## Current architecture — SPLIT COMPLETE

All logic has been extracted from the HTML into separate JS files.

### Files on disk

| File | Status | Contents |
|---|---|---|
| `index.html` | **Active host** | CSS, HTML scaffolding, 31 `<script src>` tags, no inline JS |
| `globals.js` | ✅ Extracted | `apiKey`, `busy`, `lastAction`, `panelCol`, `secCol`, `activeChatTab`, `pendingChar`, `pendingSpellPool`, `pendingBumps`, `currentBump`, `rvGold`, `customRules`, `RENDER_MODELS`, `pendingCompanions` |
| `wasm-probe.js` | ✅ Active (B9) | WebAssembly linear-memory probe (v1.418) — hooks the wasm instantiation entry points at load (must run before any wasm exists) and retains each instance's exported Memory, making ORT's otherwise-invisible linear-memory growth measurable on iOS and desktop alike. Loaded by BOTH index.html and the Piper synthesis iframe |
| `error-report.js` | ✅ Active (#16) | Mobile error reporting — `reportError(ctx,msg,detail)` POSTs runtime errors to a Google Apps Script webhook that emails pmegow@gmail.com (the mobile console is invisible; this is the channel). `ERROR_WEBHOOK_URL` at the top of the file (empty = disabled, one console.info). Flood control: 30s debounce (suppressed count rides the next email) + 10/session cap + reentrancy latch. Wires `window.onerror`/`onunhandledrejection` at load (browser only — node test loader skips); called from the turn/re-roll/skeleton/actions catches (game.js), summarize catch (memory.js), and the Piper narration-death crumb (tts.js). Transport seam `_erSend`/`_erPost` is test-stubbed. **#16c diagnostics:** per-page-load `ER_SESSION_ID` (report correlation), `erCrumb(evt,data)` — a bounded, localStorage-persisted breadcrumb ring recovered at next boot by `erLoadPrevCrumbs()` so a PROCESS KILL's final seconds survive (only pre-written state can), and `erDiagBlock()` appended to every crash `detail` within a budget. All of it rides in `detail` ON PURPOSE — the GAS sheet is a fixed 15-column schema in a user-deployed script, so a new column means a redeploy + migration. **#16b user reports:** `sendUserReport`+`erReportContext`+`ER_REPORT_HINTS` (message-keyword → extra state table; never keys/tokens) here; the modal + DOM-screenshot capture (`showBugReportModal`/`_bugCapture`, vendored `/vendor/html-to-image/` — `toSvg` only, own canvas encode; the lib's `toJpeg` hangs in embedded Chromium; `_bugShotFilter` drops src-less `<img>`s and `imagePlaceholder` absorbs unfetchable ones — without both, one bad img rejects the whole toSvg) in ui-modals.js; File ▸ ⚠ Report bug in the buildFileMenus spec (game screen only) |
| `compress.js` | ✅ Active | Self-contained LZ-string UTF-16 compressor (`LZ.compressToUTF16`/`decompressFromUTF16`, public-domain LZString, no deps) — compresses ONLY the transcript at the localStorage boundary (see §3 transcript compression); loads right after error-report.js in the SW app shell and the headless test runner |
| `data.js` | ✅ Extracted | Game data constants (TONES, ANCS, SPELLS, ARCH_SPELLS, STAT_BUMP_LEVELS, DEITY_MAP, DEITY_CENTRIC, DEFAULT_RULES, SPELL_PICK_LIMITS, SKILLS, SKILL_LEVELS, SKILL_THRESHOLDS). **C6-③ (2026-08-03): the class tables (CLSS/ABILS/ARCHETYPES/CLASS_FEATURES/XP_LEVELS/STAT_PRIORITY) are DELETED — class_bible.js is the store, read via classDef()/classDefs()/classFeaturesAt()/archFeaturesAt()/classXpLevels() (helpers.js)** |
| `capability_bible.js` | ✅ Active | The unified `capability_bible` (TODO #10) — `CAPABILITY_BIBLE` holds spells AND abilities (no intrinsic difference; `kind` is cosmetic, `cost`+`isMagical` are the real axes). Keyed by base name (`capBaseName()`); schema `{kind:"spell"|"ability", tier, cost, isMagical, category, range, targets, duration, effect, dice?, save?}`. **`category`** is a LIST of traditions (`arcane`/`divine`/`primal`/`necromantic`/`martial`) — the gate for limiting a rolled enemy caster's menu (e.g. Turn Undead is `["divine","necromantic"]`); **`capabilitiesByCategory(cat)`** returns the matching list (base + overlay). **Fixed attribute set:** every entry carries all of `cost/range/targets/duration/save/dice`, `"N/A"` where inapplicable — so the card always shows the same 6 rows (no variance) and the GM's injected canon can never be queried empty. `capBibleLine()` (api.js) renders one labeled, complete injection line. **`capabilityLookup()`** — the ONE lookup for card, viewer, and injection: emergent `worldState.capabilityBible` overlay (written write-once by `[SPELL_DEF:]`; carries `category=a,b`) wins over the static base. An ability that is really a spell (Hunter's Mark) resolves to its spell canon — no dup. Anti-drift injection: `buildSpellBibleBlock()` + `buildAbilityBibleBlock()` (api.js) re-inject canon for the player's known spells/abilities every turn (volatile half). Genuinely-different domains (item/creature/profession) get their own `*_bible` files |
| `helpers.js` | ✅ Extracted | Utility functions: `smod`, `skillLevel`, `initSkills`, `alignLabel`, etc. Plus `bibleCardHTML(name,entry)` (TODO #10) — the shared pure capability-card renderer used by BOTH the in-game click-card and `bible_study.html` (one render, two hosts) |
| `state.js` | ✅ Extracted | `store`, `worldState`, `sessionLog`, `memory`, save/load functions, storage key constants |
| `storage-adapter.js` | ✅ Extracted | Cloud sync: `loginWithServer`, `syncToServer`, `syncCampaignList`, `loadFromServer`, `logoutFromServer`, `listCharacterLibrary`, `saveCharacterToLibrary`, `deleteCharacterFromLibrary`; `authHeader()` (#90 — the assembled Authorization header for the tnd-tts app, never the raw token) |
| `memory.js` | ✅ Extracted | `sessionTokens`, `fileNpcEvent`, `fileLocation`, `fileLore`, `fileDecision`, `fileFutureEvent`, `resolveFutureEvent`, `memoryTOC`, `memoryNpcDetail`, `summarize` |
| `clock.js` | ✅ Active (#73) | The CAMPAIGN CLOCK — ONE monotonic scalar `worldState.clock.min`; the day/hour/minute view is DERIVED, never stored. The GM does ZERO arithmetic: it emits duration estimates (`[TIME_ADVANCE:2h]`), the engine does every add and RECOMPUTES every countdown from the anchor (a number the GM never re-states cannot drift — the invented-solstice-countdown class). Schedule store (`scheduleAdd`/`scheduleDue`) + `buildClockBlock()` prompt injection; per-response advance cap `CLOCK_MAX_RESPONSE_ADVANCE`. Full spec: DOC/DOC_clock.html |
| `tag_table.js` | ✅ Active (UA1) | ⛨ **THE tag registry** — one ordered table (`TAG_TABLE`, ~57 handlers in the exact pre-UA1 `applyMuts` order) from which three formerly hand-synced surfaces DERIVE: `applyMutsTable()` (THE parser), `buildCtTags()`/`buildCtBare()` (cleanTxt's strip regexes), and `buildStateTagsDoc()` (the STATE TAGS prompt block — byte-identical to the money-tested text, frozen by engine tests). **SOLE PARSER** — the legacy parser + shadow/parity machinery are DELETED after a full validation arc with zero diffs ever ([history](DOC/CLAUDE_HISTORY.md#tag_tablejs--the-ua1-validation-arc)); rollback of the deletion is `git revert`, not a flag. Retained tripwires: `__tagUnknownScan` (unknown tags warn — called unconditionally by the `applyMuts` veneer), `__tagNoCombatWarns` (UA27), coverage guards + frozen strip/doc hashes in the test suite. Adding a tag = one table entry (parse+strip+docs land together, phantom class impossible). `TAG_NO_HANDLER` documents the deliberate parse-less names (DICE/ACTIONS/RETCON/SAY — see tag_table.js for truth). Smoke-replay tool: `dev/diff-replay.js <corpus.json>` (asserts no throws/handler errors, serializes the end state for cross-version byte comparison). |
| `api.js` | ✅ Extracted | `callGM`, `buildSysPrompt`, `getRulesBlock`, `applyMuts` (a thin veneer — `applyMutsTable()` + `__tagUnknownScan()`; the legacy parser is deleted), `findCompanionChar`, `cleanTxt` (regexes derived from tag_table), `diceTxt`, `parseActions`, `buildGeoBlock` |
| `table-talk.js` | ✅ Active (#76) | The Table Talk HELP AGENT — an out-of-character help desk answering factual questions about the app, the rules, and this campaign's own history; NEVER advances the story. Deliberately does NOT call `buildSysPrompt` or reuse its stable half (a second, differently-shaped prefix in front of the cached block would silently kill gameplay prompt-cache hits — the UA5 cost-regression class). Structural isolation (TT can never reach `commitGmTurn`/`applyMuts`/transcript/sessionLog) is pinned by the #76 TABLE TALK ISOLATION CONTRACT in run-tests.js |
| `campaign_generator.js` | ✅ Active (#59) | ⛨ Shared campaign-skeleton generator + one-pass review — the "generator API" (client-side, no server) serving TWO consumers: `game.js generateSkeleton()` (on-the-fly skeleton at freeform campaign start gets ONE review pass ala the designer + auto-correction; failure falls back LOUDLY to the valid first draft — never blocks start) and the designer's "✨ Generate…" one-click draft blueprint. Contents: verbatim-extracted skeleton prompt fragments (`skelActsSchema`/`skelRulesHead`/`skelRulesTail` — the assembled game prompt is byte-identical to pre-extraction), `validateSkeletonStructure`/`stampSkeletonStatus` (pure, engine-tested), `reviewCampaignSkeleton` (skeleton-scoped: designer "story" chunk + name-drop check + engine-contract + convergence rules; ONE fix per finding, cap 8), `correctCampaignSkeleton` (apply-all → re-validate), `generateBlueprintDraft`. No DOM, no state writes, no toasts — callers own failure surfacing. `worldState.skeleton` shape and `buildSkeletonBlock` untouched |
| `char-creation.js` | ✅ Extracted | All wizard step logic, `cs`, `confirmChar`, archetype/spell/stat-bump pickers |
| `game.js` | ✅ Extracted | `sendAction`, `sendSuggestedAction`, `beginAdventure`, `retryLast`, `checkLevelUp`, `showArchetypeModal`, `pickArchetype`, `showStatBumpModal`, `restSpells`, `doRender`, `newGame`, `syncCharSheet`, `checkLegacyCharacter`, `checkCompanionLevelUp` |
| `ui-*.js` (×10) | ✅ Split (#54) | ui.js decomposed per [UI_SEAM_MAP.md](DOC/UI_SEAM_MAP.md), load order below. One job per file: |
| `ui-shell.js` | ✅ | toasts, screen switching, message log (`showToast`, `addMsg`, `showGame`/`showChar`, `switchTab`, `closeAllMenus`) — loads first; called by nearly every other file |
| `ui-panels.js` | ✅ | `syncUI` + the live panels (HUD, party, quest, inventory/abilities/spells, combat, membar, sync badge) |
| `ui-portrait.js` | ✅ | portrait pan/zoom/drag, `compressPortrait`, `showPortraitModal` (the fal.ai portrait-gen sub-app) |
| `ui-files.js` | ✅ | campaign folder, `buildFilename`/`exportToFolder`, save/blueprint/narrative export + `importSave` |
| `ui-sheets.js` | ✅ | char/NPC sheet rendering (`csSheetSections` one-renderer-three-hosts), `showCharSheet`/`showNpcSheet`, `generateNpcSheet`, `_switchPlayerCharacter`, `showCapabilityCard` |
| `ui-browsers.js` | ✅ | character/blueprint/companion browsers, character import/export flows, `_renderCompanionSlots` |
| `ui-campaigns.js` | ✅ | campaign picker + CRUD, cloud push/pull, server connect/disconnect |
| `ui-carmode.js` | ✅ | the Car Mode overlay (#2) |
| `ui-modals.js` | ✅ | settings & utility modals (rules, sync, render options, provider, usage, prose, quest journal, bug report) |
| `ui-boot.js` | ✅ | `buildFileMenus`, `wireButtons`, init/bootstrap — LOADS LAST; ends with the window load listener |
| `tts.js` | ✅ Active | Text-to-speech: `TTS` module with a `TTS_PROVIDERS` table (mirrors the LLM `PROVIDERS` shape in globals.js): `server` / `piper` (local WASM, offline, $0 — TODO #41; vendored at `/vendor/piper/`, voices cached in OPFS after one ~60MB download) / `native` (browser speechSynthesis). Engine selection is RESOLVED, never stored — there is no picker ([history](DOC/CLAUDE_HISTORY.md#ttsjs--provider-evolution)). **Server tier (#90 M1):** `TTS_LADDER = server → piper → native` — a connected player's narration synthesizes on the self-hosted **`tnd-tts` Fly app** (same 19 Piper voices, `POST /api/tts` per unit, `_speakServer` = the `_speakPiper` loop with predict()→fetch), zero client wasm work; `getEngine()` resolves `"server"` when connected+healthy, else the constant `"piper"` (offline/unconnected devices are pure-Piper). Any server unit failure hands the read's remainder down the ladder via the queue + a 60s retry memo (degrade toasted once per session, D3). Self-hosting is why the #84/LiveKit cost/ownership objection doesn't apply — it's our own box ([DOC/liveKit_findings.html](DOC/liveKit_findings.html)). The per-item **downgrade-to-native** ladder survives below all of it — runtime availability (`_piperOk`) can drop ONE item to native without changing the engine; the work-budget governor meters ONLY the local Piper tier (the server tier has no client work to budget) and remains the offline tier's guardian forever. Shared text-prep (`normalizeForTTS`/`splitSentences` with per-caller `dashRepl`/`commaSplit`), queue/scheduler, voice bank |
| `stt.js` | ✅ Active | Speech-to-text input: `STT` module with **two independent paths**. ① **Native** — Web Speech API (`webkitSpeechRecognition`, zero-dependency, no key, no network): Chrome/Edge desktop + Android Chrome; NOT Firefox; iOS Safari has NO SpeechRecognition at all. ② **Cloud fallback** — when native is absent AND an OpenAI key is on file, `MediaRecorder` captures the utterance (15s cap) and `whisper-1` transcribes it. **This is what makes the iPhone Safari / Car Mode path work** ([history](DOC/CLAUDE_HISTORY.md#sttjs--the-stale-doc-lesson-84)). A fully separate code section below the native one, so native behavior stays byte-identical wherever native exists; `isSupported()` gates the mic button on EITHER path being usable. Both paths run their final transcript through **`sttCorrectNames`** (helpers.js) — roster-phonetic correction for fantasy proper nouns, roster snapshotted once per listen. Prefs: language + auto-send (`tnd_stt_lang_v1`/`tnd_stt_autosend_v1`) and Car Mode auto-listen (`tnd_car_autolisten_v1`, default ON when unset). Notifies the Car Mode overlay via the global `carNotify(kind,text)` (ui-carmode.js), always behind a `typeof` guard. ⚠ **Transcription cost rides the PLAYER's own key** — that ownership property was decisive in declining LiveKit |
| `sound.js` | ✅ Active (#7) | UI sound library — short, WebAudio-SYNTHESIZED earcons for game events (level up, defining moment, combat start); no audio files, no deps, no network. ONE lazy singleton AudioContext (monotonic-resources rule: created on first play, reused forever; each note's nodes disconnect `onended` so nothing accumulates). `Sound.play/preview/playIfQuiet` + enabled pref; mirrors the TTS.earcon house style (debug for benign skips, warn for caller mistakes, never throws). Node-safe — the headless runner evals it |
| `bible_study.html` | ✅ Active | Satellite viewer (TODO #10) for the `*_bible` registries — open directly (like `blueprint-designer.html`, NOT in the SW app shell). Loads the bible data + helpers, renders every spell/ability via the shared `bibleCardHTML`; live name/text filter. **Deliberately READ-ONLY** (user call 2026-07-27): the bibles may become player-facing, so the mutable surface lives in `bible_editor.html`, never here |
| `class_bible.js` | ✅ Active (#72 — **ENGINE-WIRED, C6 complete 2026-08-03**) | THE single definitive source for character progression: the C6 sequence landed (v1.533 ②: classDef() store swap + shell wiring, invariant frozen-literal-tested; v1.534 ③: legacy tables deleted). The engine reads it via classDef()/classDefs() + classFeaturesAt()/archFeaturesAt()/classXpLevels() (helpers.js); level-ups grant NAMED class rows (2/5/7/9/11/13/15/17) and the committed archetype's rows (3/6/10/14/18+20), player and companion alike; the XP curve runs to L20 (L11 gate 85000). Generated from the live engine tables ([history](DOC/CLAUDE_HISTORY.md#class_biblejs--bible_editorhtml--the-72-build-out)) — 9 classes, 27 archetypes, spec-R2 level grids (class 2/5/7/9/11/13/15/17 · archetype 3/6/10/14/18 + capstone 20), `CLASS_XP_LEVELS` 1–20 (L1–10 shipped verbatim, 11–20 draft), C2 spellTiers, C5 skillSeeds. 234 level slots, 36 seeded from CLASS_FEATURES with their real names, 198 fill-phase blanks. Machine-REGENERATED by bible_editor.html's exporter — canonical form `JSON.stringify(x,null,2)` between the `>>> CLASS BIBLE DATA` markers, byte-pinned by the BIBLE EDITOR CONTRACT (run-tests.js); content hand-edits in canonical form are legal, format drift fails the build. Coverage guard: every spell NAME in it must resolve via `capabilityLookup` (a new spell and its capability entry land in the SAME commit). In the app shell (index.html + sw.js APP_SHELL) since C6-② — left the network-first regex the same commit |
| `bible_editor.html` | ✅ Active (#72) | **Dev-only authoring satellite** for the `*_bible` files — separate from the read-only bible_study by design (bibles may go player-facing; players must never find a mutable surface). Opens a bible from disk and **SAVES BACK OVER IT** via the File System Access API (verified working from `file://`). Save overwrites in place behind a confirm; a lapsed handle parks and is re-granted through a **Reconnect** button inside a click gesture (FSA re-grant requires a user gesture — the #30 permission lesson); no FSA → a file input imports and Save falls back to download, loudly. **Bible types are a REGISTRY** (`BIBLE_TYPES`: detect/parse/serialize/render) — adding the item bible later is ONE entry, not new branches. Two types ship: **class_bible** (machine-regenerated wholesale) and **capability_bible** (HAND-COMMENTED — untouched entries re-emit as their original source lines and every comment survives, so a save is a minimal diff; contract-pinned BOTH ways, unedited round-trip AND all-dirty emit). Class view: resolve badges (✓/●/○ → the fixed-6-attribute form), 234 level slots with the archetype rubric + narratability/enforceability guidance inline, spell chips, XP tab. Capability view: filterable list, per-entry edit/add/delete. Draft persists to `tnd_bible_editor_draft_v1` (v1 class-only drafts are MIGRATED, never discarded) |
| `author_voice_lab.html` | ✅ Active (#104) | **De-branding test satellite** for the prose-voice feature (open directly; network-first in sw.js). Tests whether 12 shared attribute dials (1–10, two-layer model with per-author signature devices — analysis in [DOC/DOC_author_voice.md](DOC/DOC_author_voice.md)) re-create each author's voice with NO author name in the prompt. One collapsible row per `AUTHORS` entry (+ a **Custom** all-5s learning row, dial-rewrite only): flavor-reference passage, vertical dial sliders at rated baselines (full attribute names, live band-text tooltips on sliders and action buttons), dial-only rewrite / +devices / distilled-name-free / author-name-control buttons (the DISTILLED arm — `VOICE_DISTILLED`, one coherent name-free paragraph per voice — exists because the first field run showed a name acts as a pointer into the model's corpus while a dial list is a description it averages). Loads globals.js + data.js read-only; key from localStorage (session-only manual fallback); slider tweaks persist in `tnd_voicelab_v1`; `?stub=1` or `#stub` fakes the model call. Seam: `window.__voiceLabTest`; VOICE LAB CONTRACT (run-tests.js) pins lockstep-with-AUTHORS, name-free prompts, and the sw.js allowlist entry — sabotage-proven |
| `bug_tracker.html` | ✅ Active (#71) | Satellite viewer for the **bug-triage pipeline** over the #16 reports. GAS v2 (`dev/gas-error-webhook.gs`, user-deployed) dual-writes every report: email (notification) + Google Sheet (record; screenshots → Drive) + secret-gated `doGet` JSON feed. Tracker = `DOC/BUGS.md` (format contract in its header — fingerprint dedup, lifecycle statuses, report bodies fenced as UNTRUSTED data); ops = the `/bugs` skill (`.claude/skills/bugs`): `sync` (feed → tracker), `investigate` (dispatches `.claude/agents/bug-investigator` — Read/Grep/Glob ONLY, mechanical injection containment), `act` (gated on findings; drift-surface flag → Fable policy). Viewer buttons COPY the /bugs command to clipboard (a page can't dispatch agents); live server section reads the doGet feed directly (secret via 🔑 → that browser's localStorage; deduped by report id against filed rows). ⚠ ALL report-derived text renders via `textContent` — never innerHTML (XSS-verified); **new satellites must be added to sw.js's network-first allowlist or the SW pins them stale**. Feed secret lives in gitignored `.claude/bugs.local.json` |

### Script load order

```
globals.js → wasm-probe.js → error-report.js → compress.js → data.js → capability_bible.js → class_bible.js → helpers.js → state.js → storage-adapter.js → memory.js → clock.js → tag_table.js → api.js → table-talk.js → campaign_generator.js → char-creation.js → game.js → ui-shell.js → ui-panels.js → ui-portrait.js → ui-files.js → ui-sheets.js → ui-browsers.js → ui-campaigns.js → ui-carmode.js → ui-modals.js → ui-boot.js → tts.js → stt.js → sound.js
```

Each file depends only on symbols defined by files earlier in this list. The ENGINE subset of this order (minus the DOM-wiring files: wasm-probe, char-creation, ui-*, stt) lives as data in `dev/engine-manifest.js` — the single list both `dev/load-engine.js` (node) and `test.html` (browser, generated tags + load guard) derive from, mechanically checked against index.html by the ENGINE MANIFEST CONTRACT in run-tests.js (review 2026-08-01; the old manual test.html copy had silently dropped clock/table-talk/sound — the #17 rot class).

---

## HTML screens

| Element | Purpose |
|---|---|
| `#api-screen` | API key entry (shown on first load) |
| `#char-screen` | 6-step character creation wizard — has its own File ▾ menu at top |
| `#game-screen` | Main game interface |
| `#lineage-popup` | Sub-popup for Half-Blood lineage selection |
| Dynamic modals | `#creation-arch`, `#creation-bump`, `#creation-spells`, `#arch-modal`, `#sb-modal`, `#rules-modal`, `#sync-modal`, `#cs-modal`, `#camp-modal` — all appended to `<body>` at runtime |

## Game screen layout

```
#topbar              — HUD: name, HP, gold, alignment, location + action buttons
                       Buttons: Sheet | Sync | Render | Rest | Retry | File ▾
#sidebar             — Slide-out world state panel (fixed, off-screen by default)
#membar              — Memory status bar (~tokens / chapters / NPCs / turn number)
#cpanel              — Combat tracker (HP bars, rounds) — hidden when not in combat
#story-area
  #story-narrative   — Scrolling narrative message log (Story tab)
  #story-tabletalk   — Scrolling table talk log (Table Talk tab, display:none by default)
  .rpanel            — Collapsible right panel: Inventory / Abilities / Spells sections
#inputarea
  #inrow             — Text input + Send button
  #chat-tabs         — Two pill tabs: Story | Table Talk
```

---

## Key systems

### 1. Character creation wizard (6 steps)

| Step | Content |
|---|---|
| 1 – Tone | Choose world tone: High Fantasy, Gritty, Sword and Sorcery, Dark Horror, Political Intrigue, or Custom, plus prose-voice pick. Bottom of step has "↩ Import existing save" file input and "⚙ Load blueprint". |
| 2 – Identity | **Merged with Ancestry (TODO #25).** Gender (M/F/NB), age, then an Ancestry picker inline below: 7 ancestries (Human, Elf, Dwarf, Gnome, Half-Blood, Hollow-Born, Tiefling), each with 2–3 subraces; Half-Blood has nested lineage selection via `#lineage-popup`. Picking an ancestry swaps the grid (`#anc-grid-wrap`) for a detail view (`#anc-detail`) in place — "← All ancestries" (`anc-back-detail`/`hideAncDetail()`) returns to the grid without leaving the step. Single Back/Next pair (`id-back`/`anc-next`) for the whole step; `anc-next` validates ancestry + subrace + lineage (if applicable) + flex stat picks before advancing. |
| 3 – Class | 9 classes (Warrior, Rogue, Sorcerer, Ranger, Primal, Paladin, Cleric, Druid, Necromancer) |
| 4 – Attributes | Roll 4d6 drop-lowest (auto-assigned by the class's bible `statPriority`) or Point Buy (27 pts, using `PBC` cost table); stated alignment; auto-suggested deity for Cleric/Paladin/Druid |
| 5 – Finishing Touches | Physical description, backstory, portrait (upload / render from sheet / derive appearance from portrait) |
| 6 – Review | Full character preview + campaign name + starting location + starting level (1–10) + companion selection (up to 3) — **party cap is `PARTY_MAX`=4 total** (player + companions): the creation picker, the mid-game import, and the `[PARTY_MEMBER:\|true]` handler all enforce `partyCompanionCap()` (= `PARTY_MAX - playerCount`, 3 today; multiplayer #1 makes playerCount dynamic). `buildSysPrompt` injects a live "PARTY SIZE: N of 3 … FULL" note so the GM doesn't narrate a join it can't make; the `applyMuts` cap is the backstop (keeps the over-cap NPC as a non-party ally). **Manual departure:** the NPC sheet has a "Part ways" button → `partWaysWithCompanion()` flips `partyMember` off (NPC kept, slot freed) and sets transient `worldState.recentlyLeft`, which `buildSysPrompt` surfaces as a "PARTY DEPARTURE" note (auto-cleared in `sendAction` after ~2 turns, same pattern as `recentSwitch`) so the GM stops narrating them as present. |

After step 6, if level ≥ 3: archetype picker → stat bump(s) → spell picker → `startGame()`.

**Step 2 uses `<select id="char-gender">` with options M/F/NB** — pronouns have been removed from the character schema entirely.

**Starting languages** are derived automatically in `confirmChar()` from ancestry/subrace and stored in `char.languages[]`:
- All characters start with Common
- `ancLangMap`: elf→Elvish, dwarf→Dwarvish, gnome→Gnomish, tiefling→Infernal, hollow→Umbral
- `subLangMap` (halfblood subraces): half_elven→Elvish, half_orcish→Orcish, half_draconic→Draconic, half_infernal→Infernal, half_fey→Sylvan, half_gnomish→Gnomish

### 2. Game data constants (all in `data.js`)

- `TONES` — 6 tone presets, each with a `vc` (voice directive sent in the system prompt)
- `AUTHORS` — Prose-inspiration voices (TODO #23), each `{id, nm, blurb, vc, profane?}`. `vc` is a style directive injected into the system prompt by `buildSysPrompt` (`proseBlock`); `profane:true` voices (Abercrombie, Dinniman, Muir) swear only when `adultMode` is on, otherwise keep the rhythm but stay clean. Selected via **Dev Mode ▸ ✍ Prose inspiration…** (`showProseModal()`), read live so it takes effect next turn. **Per-campaign:** the choice is stored on `worldState.proseAuthor`, so it rides the sync blob and follows the campaign across devices; `buildSysPrompt` uses `worldState.proseAuthor` when set, else the device default (global `proseAuthor`, loaded from `PROSE_K`/`tnd_prose_v1`). Saving in-game pins the campaign AND updates the device default; pre-game selection sets only the default, which new/unset campaigns inherit via the fallback. ⚠ **Never re-add a hard sentence/length cap to STYLE** — the old `2-3 sentences maximum` cap was the run-on root cause (capping count makes the model cram everything into one dense sentence; [history](DOC/CLAUDE_HISTORY.md#2-authors--the-sentence-cap-removal)). The STYLE rule forbids clause/em-dash/simile cramming and hands length/rhythm to the selected prose voice.
- `ANCS` — Ancestry definitions with `stats`, `traits`, `subraces`, optional nested `lineages`, and `racial_caps` (see below)
- ~~`CLSS` / `ABILS` / `ARCHETYPES` / `CLASS_FEATURES` / `XP_LEVELS` / `STAT_PRIORITY`~~ — **deleted at C6-③ (2026-08-03)**: class chassis, starting abilities, archetypes, level features, XP thresholds and rolled-stat priority all live in `class_bible.js`, served by `classDef()`-family accessors (helpers.js). XP curve is `CLASS_XP_LEVELS` (1–20; L1–10 = the old shipped thresholds verbatim, L11 gate 85000, L20 = 355000)
- `SPELLS` — Spell lists for Sorcerer, Cleric, Druid, Ranger, Paladin, Necromancer (cantrips + levels 1–3). **Necromancer also has a tier 4** (Rigor Mortis, Possess Thrall, Sleep of the Dead) — tiers are intentionally open-ended; creation only ever offers up to tier 3 (`buildPendingSpellPool` caps `maxSlot` at 3), so higher tiers are GM-grantable / high-level content only.
- `ARCH_SPELLS` — Extra spell lists for Eldritch Knight and Arcane Trickster archetypes
- `STAT_BUMP_LEVELS` — `[4, 8]` (levels where +2 stat improvement is awarded)
- `DEITY_MAP` + `DEITY_CENTRIC` — Alignment-based deity suggestions for Cleric/Paladin/Druid
- `DEFAULT_RULES` — ~28 hard GM rules always injected into the system prompt (incl. character sheet upkeep, engine-controlled XP/leveling, mandatory NPC registration on direct interaction, quest lifecycle, active-crises-are-quests, player-actions-are-intent). Count grows over time — see data.js for truth; an editorial merge pass is queued as AUDIT_FABLE #19.
- `SPELL_PICK_LIMITS` — Max spells selectable per tier during creation: `{cantrips:2, "1":2, "2":2, "3":1}`
- `SPELL_UNLOCK_PICKS` — **#72 C2 (2026-08-03):** picks granted when a spell tier UNLOCKS in play: `{"1":2,"2":2,"3":1,"4":1,"5":1,"6":1}` (per-class counts are template-iteration material)
- `SKILLS` — Array of 37 skill objects `{id, label, cat}` across 8 categories (Physical, Endurance, Wilderness, Knowledge, Craft, Social, Roguish, Perception). Wilderness includes **Tracking** (WIS/INT), which doubles as urban tailing.
- `SKILL_LEVELS` — `["Unskilled","Familiar","Trained","Proficient","Expert","Master"]`
- `SKILL_THRESHOLDS` — `[1, 5, 12, 25, 50]` (cumulative successes to reach levels 1–5)

**`skillLevel(successes)`** returns 0–5 based on `SKILL_THRESHOLDS`.
**`initSkills()`** builds a zeroed skill map `{skillId: 0}` for all 37 skills (derived from `SKILLS`, so adding one needs no change here).

**Racial capabilities (`racial_caps`, single-sourced in the bible):** Ancestries, subraces, and lineages in `ANCS` carry a `racial_caps:[]` list that **references `capability_bible.js` by base name** — the mechanics live ONLY in the bible (change Faerie Fire once, everywhere updates). Each entry is a bare string (passive/at-will grant) or `{cap:"Name", use:"1/day"}` (adds a recharge to the display name). `confirmChar` (char-creation.js) gathers ancestry + subrace + lineage caps, dedupes, applies one supersede (Superior Darkvision > Darkvision), resolves each via `capabilityLookup`, and pushes bible **spells → `char.spells`** (`racial:true`) and bible **abilities → `char.abilities`** (`ds` pulled from the bible `effect`). Because the names are canonical, `buildSpellBibleBlock`/`buildAbilityBibleBlock` auto-inject their canon to the GM every turn. The subrace/lineage still contributes one flavor `[Racial] <name>` identity ability; `traits[]` and `desc` remain human-readable wizard-preview summaries (NOT the authoritative def). Scope: actives + lookup-worthy passives (Darkvision, Fey Ancestry, Gnomish Cunning, resistances, breath weapons, Camouflage, Relentless Endurance, Hellish Rebuke, etc.); pure flavor (Versatile, Outsider) stays as ancestry text. Category `"racial"` marks innate heritage traits — drawn by no caster tradition, so they never surface in a rolled enemy caster's menu. A coverage-guard test blocks a `racial_caps` key with no bible entry from shipping. The old `racial_spells:[{nm,lvl}]` field is **removed** (fully replaced by `racial_caps`).

### 3. State management (in `state.js`)

Three live objects, all persisted to `localStorage` via the `store` wrapper:

| Object | Storage key | Contents |
|---|---|---|
| `worldState` | `tnd_core_v10` | `character`, `world` (location/region/time/weather/threat), `npcs[]`, `questLog[]`, `eventHistory[]`, `combat`, `turn` |
| `sessionLog` | `tnd_sess_v10` | Current-session messages sent to the API (`[{role, content}]`); cleared on summarization |
| `memory` | `tnd_mem_v10` | Long-term narrative memory: `npcs{}`, `locations{}`, `quests{}`, `lore[]`, `keyDecisions[]`, `futureEvents[]`, `chapters[]` |

`store` wraps `localStorage` with an in-memory fallback `_m`. Storage key constants (`WSK`, `SLK`, `MEM_KEY`, `AKK`, `RLK`) are defined in `state.js`.

**Transcript compression:** the append-only `worldState.transcript` is the dominant, ever-growing part of a mature save (it caused localStorage quota death on mobile; [history](DOC/CLAUDE_HISTORY.md#3-transcript-compression--the-t308-evidence-v1227)). `saveCore` writes `worldState` via **`serializeWorldState()`**, which LZ-compresses ONLY the transcript field inline (`transcript` → `{__lz:"…"}`) — roughly halving the on-disk core. `loadState` reads via **`parseWorldState()`**, which inflates it and is **tolerant** — a plain-array transcript (server sync blob, `.tnd` import/export, legacy pre-v1.227 save) passes straight through. **In-memory `worldState.transcript` is ALWAYS the plain array**; only the localStorage boundary (`saveCore`, the server-pull writes, and the camp-snapshot copies of `WSK`) carries the compressed form. Compressor: `compress.js` (see files table). Degrades safely to plain JSON if `LZ` is absent. Round-trip is engine-tested against real save data — this is save data, so a compressor bug would CAUSE data loss.

Campaign list metadata stored in `tnd_camps_v1` — array of lightweight campaign entries used by the campaign picker.

### 4. v10 Character schema

```javascript
{
  name, gender,           // gender: "M" | "F" | "NB"  (replaces pronouns)
  age, appear, mark, backstory,
  ancestry, subrace, subraceNm, heritageVariant,
  cls, stats, hp, maxHp, gold,
  inventory[],            // plain strings
  level, xp,
  abilities[],            // {nm, ds}
  spells[],               // {nm, lvl, used, racial?} — used = "cast since rest" (hard gate ONLY for racial 1/day; #110)
  mana,                   // #110 spend-by-tier pool — current points; max is DERIVED (manaMax), never stored; absent = full
  archetype, archetypeNm,
  statedAlignment, actualAlignment, alignLaw, alignGood,
  deity,
  trait, flaw, motivation,
  languages[],            // {name, broken}
  skills,                 // {skillId: successCount} — all 37 keys, zeroed at creation
  conditions[],           // {name, duration}
  relationships[],        // {entity, descriptor}
  saveModifiers[],        // {source, type, amount}
  portrait,               // null | base64 data URL (compressed to max 400×600px JPEG 0.8)
  storyBeats[],           // {text, turn}
  coreMemories[],         // {text, turn, kind, who, camp} — #63: defining moments, witnessed-by-all, portable across campaigns (see §8c)
  partyMember             // bool — always true for the player character
}
```

`worldState` also carries `campId` (string matching `tnd_active_v1`) so the campaign ID survives exports and reimports without creating duplicate campaign slots, and `proseAuthor` (per-campaign prose-inspiration voice id — see AUTHORS above).

### 5. API usage

**Provider-agnostic.** `callGM()` routes through the active provider in the `PROVIDERS` table (`globals.js`). Each provider is a self-contained object — `{id, label, keyHint, endpoint, defaultModel, models[], headers(key), buildBody(msgs,sys,maxTok,model), parseResponse(json), parseUsage(json)}` — and `callGM()` picks `PROVIDERS[activeProvider]` and calls its methods. **No `if(provider===...)` branches anywhere else.** This same shape is the intended server-side routing table under the subscription model.

- **anthropic** — `https://api.anthropic.com/v1/messages`; `x-api-key` + `anthropic-dangerous-direct-browser-access: true`; system as a top-level `system` field — **a two-block array for gameplay turns**: `[{stable + cache_control:ephemeral}, {volatile}]` (prompt caching, see §6), plain string for sysOverride calls; response at `content[0].text`. Default model `claude-sonnet-4-6` — **verify this string is current before starting work each session.**
- **openai** — `https://api.openai.com/v1/chat/completions`; `Authorization: Bearer`; system carried as a leading `{role:"system"}` message; response at `choices[0].message.content`. Default model `gpt-4o`. (CORS: OpenAI allows direct browser calls, no special header.)
- **grok** — `https://api.x.ai/v1/chat/completions`; OpenAI-compatible (same body/response), `Authorization: Bearer`. Default `grok-4.3` (see `PROVIDERS` in globals.js for the current list — old grok-2-*/grok-beta IDs are retired).
- **gemini** — `endpoint` is a **function(model)** (`.../v1beta/models/{model}:generateContent`) since Google embeds the model in the URL; `x-goog-api-key` header; system in `systemInstruction.parts[]`, messages in `contents[]` with role `model` (not `assistant`); response at `candidates[0].content.parts[0].text`. Default `gemini-3.5-flash` (retired 1.5/2.0 IDs 404 — see `PROVIDERS` in globals.js for the current list). `callGM()` resolves `typeof prov.endpoint==="function"?prov.endpoint(model):prov.endpoint`.
- **ollama** — `http://localhost:11434/v1/chat/completions`; OpenAI-compatible. **Mixed-content blocked** from an https origin / unreachable from `file://` — only works when the game is served from localhost. Exploration tier.

Shared `TAG_REINFORCE` constant (globals.js) is assigned to every non-Claude provider's `reinforce` (Claude needs none). Model names in each provider's `models[]` should be verified current; the modal's dropdown is fixed to that list. **All four non-Claude adapters are shape-verified but each still needs a live tag-fidelity test (a money turn) once a key is available — same process that surfaced the gpt-4o gotcha.**

**Provider state** (`globals.js`): `activeProvider` (id), `providerKeys` ({id:key}), `providerModels` ({id:modelOverride}). Persisted via `PROV_K`/`PKEYS_K`/`PMDL_K` in `state.js`; `loadProviderSettings()` migrates the legacy `AKK` Anthropic key into the map. Switch providers / set keys / pick model via **File ▸ Dev Mode ▸ 🧠 Language Model…** (`showProviderModal()`). Keys for all providers are retained, so switching back and forth needs no re-entry.

**Per-provider prompt reinforcement:** a provider may carry an optional `reinforce` string. `callGM()` appends it to the system prompt for gameplay turns only (`if(!sysOverride&&prov.reinforce)`), never to `summarize()`. It exists because gpt-4o treats the state tags as optional — narrating "you pay 5 gold" without emitting `[GOLD:-5]`, silently desyncing the sheet ([history](DOC/CLAUDE_HISTORY.md#5-providers--the-gpt-4o-bring-up-finding-v132)) — so `openai.reinforce` is a forceful MANDATORY-TAG-DISCIPLINE block with exact formats. This is the per-provider tuning the abstraction exists for. Relatedly, the `[GOLD:]` and `[HP:]` parsers are loosened to the `/\[(GOLD|HP):\s*([+-]?\d+)[^\]]*\]/` shape so a model writing `[GOLD:-5 gp]` (which the prompt's own format hint invites) still parses.

`callGM(msg, sysOverride, maxTok, modelOverride, opts)` is the single API entry point. `opts.noHistory` sends only the given message instead of the full `sessionLog` (used by the action-suggestion call). `opts.kind` tags the call for usage telemetry (defaults: `"turn"` when no sysOverride, `"other"` for utility calls).
- `maxTok` is optional; defaults to `1000`. `summarize()` passes `2000`.
- Appends `msg` to `sessionLog` for the request body but does not push to `sessionLog` itself.

**Usage/cost telemetry (TODO #21):** every provider carries `parseUsage(json)` returning `{in, out, cacheRead, cacheWrite}` (Anthropic: `usage.*` incl. both cache counters — note its `input_tokens` EXCLUDES cached tokens; openai/grok/ollama share `OPENAI_USAGE`, whose `prompt_tokens` INCLUDES cached; Gemini reads `usageMetadata`). `callGM` passes the result to `recordUsage(u, kind, model)` (api.js), which accumulates onto `worldState.usage` — totals + per-kind buckets (`turn`/`actions`/`summarize`/`skeleton`/`sync`/`other`) + `costUSD` priced at record time from `MODEL_PRICING` (globals.js, $/MTok; unknown/non-Anthropic models count tokens but contribute $0). `blankUsage()` lives in state.js; `migrateWorldState` adds the accumulator to old saves. UI: **Dev Mode ▸ 📊 Usage & cost…** (`showUsageModal`, all three File menus) — per-kind table with input-per-call averages, estimated cost, and a Reset button. The `turn` bucket's In/call average is the before/after metric for prompt caching (#11).

Three callers:
- `sendAction()` — normal gameplay turns (1000 tokens)
- `beginAdventure()` — opening narrative on game start (1000 tokens)
- `summarize()` — memory extraction, JSON-only output (2000 tokens)

### 6. System prompt construction (`buildSysPrompt`)

Assembled fresh on every request from live state. **Returns `{stable, volatile}` (TODO #11, prompt caching)** — the STABLE half is campaign-constant text (byte-identical turn to turn; an engine test enforces this), the VOLATILE half is all per-turn state. The Anthropic adapter sends them as a two-block `system` array with `cache_control:{type:"ephemeral"}` on the stable block (re-reads at 0.1× input price, 5-min TTL); other providers flatten via `sysJoin()` (globals.js). `sysOverride` callers (summarize/actions/skeleton) still pass plain strings — those stay single uncached blocks. **Anything reading worldState/memory/sessionLog must never leak into the stable half** — one stray turn counter kills every cache hit.

**STABLE half (cached), in order:**

1. `getRulesBlock()` — default + custom narrative rules
2. Adult-content block (when enabled)
3. GM role declaration + tone directive + tone-subordination note + narrative-design DNA
4. MECHANICS/dice format + full STATE TAGS instructions + companion-tag instructions

**VOLATILE half (uncached), in order:**

5. Player identity header + transient switch/departure blocks
6. Character sheet (stats, HP, gold, alignment, abilities, spells, inventory) + conditions, relationships, save modifiers, languages, skills
7. **PARTY MEMBER SHEETS** (`partyBlock`) — for each `npc.partyMember && npc.charSheet` (alive), a rich per-companion block: class/archetype/level, HP, stats, abilities, **spells available** (unused only), inventory, conditions (#46), and **relationships (#61)** — each companion's `charSheet.relationships` as a canonical-bond line (without injection the GM hallucinated party bonds and companions never used their kit; [history](DOC/CLAUDE_HISTORY.md#6-5b-party-sheets--the-t755-finding-61-v1303)). The block header instructs the GM to have each companion act in character with their own kit, track resources via `COMPANION_*` tags, and never contradict the Relationships lines. The NPC roster line's `rel` also **derives from the player's relationship descriptor for party members** (#61) — non-party NPCs keep `npc.rel`. Backstops (#61, all NOTE_BUILDERS entries + the `relationshipSnapshot`/`stampRelationshipChanges` post-pass in game.js — zero parser contact): weighty→non-weighty descriptor overwrites queue a GM-decides downgrade nudge + warn toast; `buildRelationshipAudit` re-grounds every recorded bond each `REL_AUDIT_TURNS`=40 (bond `.turn` stamps → ages), pulled forward on party join/leave. UA41's reciprocity nudge prompts the GM to file `[COMPANION_RELATIONSHIP:]` mirrors for weighty bonds; companion↔companion bonds still only appear when the GM files them — by design, nudged when weighty.
8. World state (location, time, weather, NPCs, active quests) + party-size note
9. `memoryTOC()` — compact summary of known NPCs, visited locations, pending events, recent decisions, chapter summaries
10. `memoryNpcDetail()` — full detail on NPCs mentioned in the last 6 session messages (+ RAG excerpts after it, §8b)
11. Combat state block (if `worldState.combat` is set) + event history (last 8 compressed chapter summaries)
12. Defining moments (§8c) + identity REMINDER + style directive — **STYLE stays at the very END on purpose** (uncached tail): end-of-prompt position is load-bearing for prose-voice fidelity (audit #2). The GM writes pure prose — no `[ACTIONS:]` tag (decoupled, see §13).

**Gender in image prompts:** `doRender()` uses `c.gender==="F"?"female":c.gender==="NB"?"androgynous":"male"` — never uses pronouns.

### 7. State tag system (`applyMuts`)

The GM embeds hidden tags in every response. `applyMuts(text)` parses them and mutates `worldState` and `memory`. Tags are stripped from displayed text by `cleanTxt()`.

| Tag | Effect |
|---|---|
| `[HP:+/-X]` | Adjust `character.hp`, clamped to `[0, maxHp]` |
| `[GOLD:+/-X]` | Adjust `character.gold` |
| `[ITEM_GAINED:name]` / `[ITEM_LOST:name]` | Push/filter `character.inventory` |
| `[LOCATION:name]` | Update `world.location`, clear `sublocation`, file to `memory.locations` and `memory.map`. **Also clears `worldState.combat` on a world-location change** — the party traveled away, so any unclosed fight is over; skipping the clear would leak the old location's foes into a new fight. Runs UNCONDITIONALLY on a real move; silently (no warn/muts line) when the same response opens a fresh `[COMBAT_START:]`, which immediately rebuilds the tracker |
| `[LOCATION_DESC:text]` | Store canonical description for current location (written once on first visit, never overwritten) |
| `[SUBLOCATION:name]` | Enter a named area within the current world location; sets `world.sublocation` |
| `[SUBLOCATION_LEAVE]` | Exit sub-location; clears `world.sublocation` |
| `[TIME:value]` | Set `world.time` (free text, e.g. "dawn", "late night"). The world clock has no engine advancement — this tag and the Sync modal are the only writers (audit R2) |
| `[WEATHER:value]` | Set `world.weather` (free text, e.g. "heavy rain") |
| `[LOCATION_ITEM:name\|placed]` | Record item left/hidden at current location node; pairs with `[ITEM_LOST:]` |
| `[LOCATION_ITEM:name\|taken]` | Mark item as taken by NPC/event; player pickup auto-handled by `[ITEM_GAINED:]` |
| `[LOCATION_STATE:what changed]` | **#105/B17** — append a durable state-change note to the CURRENT map node (`stateNotes[]`, `{n,t}`, cap `LOC_STATE_CAP`=3, near-dup refresh with richer-text-wins, loud oldest-eviction; node created if never filed). The write-once `[LOCATION_DESC:]` stays untouched — this is the separate, append-only "what the story has DONE to this place" record. Read back TWO ways: `buildGeoBlock` shows the current node's (+ sublocation's) changes beside the frozen description with a this-OVERRIDES instruction, and `buildChangedLocationsBlock` (api.js) injects an ALWAYS-PRESENT remote roll-up (most-recent-first, cap `CHANGED_LOC_MAX`=10, visible "+N more" overflow, volatile half only, ""-clean when nothing changed) — always-present because the GM references distant places INSIDE its own output, where mention-triggered injection can never reach |
| `[NPC:name|status|relation]` | Upsert `worldState.npcs[]` and `memory.npcs{}`. **Death is first-class (B3):** a death status (`dead`/`slain`/`deceased`/`perished`, minus living idioms — `npcDeadStatus()` in helpers.js is THE detection) stamps durable `npc.dead=turn` on BOTH stores; once stamped, non-death status writes are REFUSED (warn + toast + `buildDeadStatusNudge` GM-decides note) — revival only via an explicit resurrection status (`[NPC:name|resurrected|…]`). Dead NPCs render as an affirmative roster `DECEASED:` line (cap 10 recent, never silent omission), are excluded from GEOGRAPHY "NPCs elsewhere", and are annotated in TOC/detail/graph. Slain REGISTERED combat foes propagate the stamp at encounter close (`propagateSlainFoes`); the summarize extractor's `npcDeaths[]` backstops untagged prose deaths (on-file NPCs only) |
| `[XP:N]` | Add XP, trigger `checkLevelUp()`. **XP parity:** automatically mirrored to every party companion's `charSheet` (+ `checkCompanionLevelUp`), EXCEPT companions named in a `[COMPANION_XP:]` tag in the same response (individual award supersedes the mirror — no double count) |
| `[QUEST:title\|status]` or `[QUEST:title\|status\|desc]` | Upsert `worldState.questLog[]`. status: `offered`/`active`/`completed`/`failed`. `offered` toasts "⚑ Quest opportunity"; `completed`/`failed` archive to `memory.quests` and remove from the live log |
| `[QUEST_STEP:title\|objective\|done]` | Add an objective to a quest (`done` omitted/false), or mark an existing one complete (`done=true`); matched by objective text |
| `[COMBAT_START:name\|hp\|ac\|atkbonus\|dmgdie\|morale]` | Multi-foe (UA26): no combat → start the encounter as `{round:1, engaged:null, foes:[foe]}`; combat active → **APPEND a foe** to `foes[]`. Duplicate name while that foe is living → ignored + warn (re-emission, not a new foe); 9th foe → ignored + warn (cap 8, runaway-model guard). g-loop: every occurrence in the response lands |
| `[COMBAT_STATS:STR:N\|DEX:N\|CON:N\|INT:N\|WIS:N\|CHA:N\|CR:N]` | Set a foe's ability scores and CR (always emit alongside COMBAT_START). Binds by **positional adjacency** (P3-F1): each occurrence goes to the foe whose `[COMBAT_START:]` most recently precedes it in the response text; with no preceding start, `COMBAT_ATTR_FALLBACK="engaged"` routes like bare ENEMY_HP (single living foe, else the engaged foe, else first living + warn) |
| `[COMBAT_IMMUNE:type,type]` / `[COMBAT_RESIST:...]` / `[COMBAT_VULN:...]` | Set a foe's damage immunities/resistances/vulnerabilities; same positional-adjacency binding + fallback as COMBAT_STATS (the three handlers are factory-generated by `combatAttrEntry`, audit #8); displayed in combat panel |
| `[ENEMY_HP:Name\|-X]` (named) / `[ENEMY_HP:-X]` (bare) | Adjust a foe's hp (clamped ≥ 0). **Named:** matched exact-then-contains (`combatFoeByName`); no match → warn, NO mutation. **Bare:** single living foe → that foe; else the ENGAGED foe (`combat.engaged` = the foe the player last damaged) if living; else first living + warn — the mutation always lands. Any hit sets `engaged`; hp ≤ 0 sets `down:"slain"` and clears `engaged` |
| `[ENEMY_SLAIN:Name]` | **Outcome assertion:** the GM narrates a kill (stealth execution, coup de grace) and the engine does the arithmetic — foe zeroed, `down:"slain"`, `engaged` cleared. NAMED ONLY: bare `[ENEMY_SLAIN]` warns + no-ops (but still strips — TAG_STRIP_BARE). Unknown name → warn, no mutation; already-down → quiet no-op. Exists because the GM's only kill vocabulary was a damage NUMBER, so narrated executions left foes standing ([history](DOC/CLAUDE_HISTORY.md#7-enemy_slain--the-t1188-trafficker-ambush-v1463)) |
| `[ENEMY_SURRENDERS:Name]` / `[ENEMY_SURRENDERS]` (bare) | Mark foe(s) `down:"surrendered"`: named → that foe via `combatFoeByName` (warn if not found); bare → ALL living foes. Clears `engaged`. A surrendered foe stays in `foes[]` and survives the fight |
| `[COMBAT_ROUND:N]` | Set `combat.round` (encounter-level) |
| `[COMBAT_END:outcome]` | Close the WHOLE encounter (`worldState.combat=null`) regardless of foe states. Without the tag, **all foes down auto-closes** — as "surrender" if any foe surrendered, else "victory" |
| `[ABILITY_GAINED:Name|Desc]` | Append to `character.abilities` (deduplicated) |
| `[ALIGNMENT:law+1]` / `[ALIGNMENT:good-1]` | Shift `alignLaw`/`alignGood` (-3 to +3), recompute `actualAlignment` |
| `[SPELL_USED:name]` | **Mana spend (#110, v1.508)** — deduct the spell's capability-bible tier from `character.mana` via `manaPayCast` (tag_table.js, shared with the companion twin). Racial `1/day` spells bypass the pool and keep the hard `used:true` gate; other spells still stamp `used` but only as informational "cast since rest". Overspend floors at 0 + loud warn — EXCEPT a Necromancer, who overdraws at `MANA_BLOOD_HP` (globals.js) HP per missing point, deducted by the ENGINE (the doc forbids the GM re-emitting `[HP:]` for it — the XP-mirror precedent). Pool math: `manaMax`/`manaCur`/`manaSpellCost` (helpers.js) — base = Σ non-racial spell tiers, +10%/point of the class's `castStat` (class-bible data since C6-②) over 16, floored; an ABSENT `c.mana` reads as full (that lazy default IS the migration ruling). Refill: `restSpells()` only |
| `[LORE:fact]` | Append to `memory.lore` (capped at 30) |
| `[DECISION:desc]` | Append to `memory.keyDecisions` (capped at 30) |
| `[FUTURE_EVENT:what|when]` | Append to `memory.futureEvents` |
| `[FUTURE_EVENT_RESOLVED:what]` | Mark matching future event resolved |
| `[NPC_NOTE:name|note]` | Append event note to `memory.npcs[name].events` |
| `[NPC_FORGET:name\|person or event]` | Scrub a specific memory from `memory.npcs[name]` — substring-filters `.knowledge[]` and `.events[]` so the fact stops re-injecting. The engine teeth behind the Arcane Trickster **Oubliate** spell (tier 4). Its lesser sibling **Lethe's Kiss** (tier 3) is narrative-only |
| `[NPC_SUPERSEDE:name\|outdated fact\|current truth]` | **#57 — reveal commitment.** Retires the matching `.knowledge[]` line(s) (substring; knowledge ONLY, events stay) to `memory.archive.superseded` and records the truth, so a reveal can't coexist with its stale hedge. No-match still records the truth + warns. The extractor side of #57: `summarize()` serves on-file facts (RECORDED FACTS) and applies `supersededFacts` echoes the same way; `sameNpc` proposals queue `buildMergeConfirmNudge` (engine note) for GM-confirmed `[NPC_MERGE:]` — never auto-merged |
| `[RETCON:what was corrected]` | GM emits when it corrects/rewinds/retracts previously narrated events. Not a mutation — `logTranscript` (state.js) marks the correcting transcript entry AND the immediately preceding GM entry with `rc:1`, and `ragRetrieve` never serves `rc`-marked entries (RAG de-index; see §8b) |
| `[NPC_PRONOUN:name|pronouns]` | Set pronouns on NPC in both stores |
| `[NPC_ALIAS:canonical|alias]` | Register alias for an NPC; all future tags using the alias silently resolve to canonical; shown in NPC list as `Name [aka: alias]` |
| `[NPC_MERGE:canonical|duplicate]` | Absorb duplicate NPC entry into canonical (merges events, knowledge, aliases); cleans up matching relationships; removes duplicate from both stores |
| `[PARTY_MEMBER:name|true/false]` | Set `partyMember` bool on NPC in `worldState.npcs` and `memory.npcs`; creates NPC entry if missing; flagged in system prompt NPC list |
| `[DICE:label|result|outcome]` | Rendered visually as a dice block (not a mutation) |
| `[SKILL_SUCCESS:skillId]` | Increment `character.skills[id]`; toast on level-up |
| `[CONDITION:name|duration]` | Push `{name, duration}` to `character.conditions` |
| `[CONDITION_REMOVED:name]` | Filter matching condition from `character.conditions` |
| `[RELATIONSHIP:entity|descriptor]` | Upsert `{entity, descriptor}` in `character.relationships` |
| `[RELATIONSHIP_REMOVED:entity]` | Filter matching relationship |
| `[SAVE_MOD:source|type|amount]` | Upsert `{source, type, amount}` in `character.saveModifiers` |
| `[SAVE_MOD_REMOVED:source]` | Filter matching save modifier |
| `[LANGUAGE:name|fluent/broken]` | Push or update language in `character.languages` |
| `[STORY_BEAT:text]` | Push `{text, turn}` to `character.storyBeats`; also calls `fileDecision` |
| `[CORE_MEMORY:subject\|text]` | **#40 GM tag** — GM-authored defining moment for the engine-undetectable class (revelations, weddings, vows; pairs with `[NPC_SUPERSEDE:]` at a reveal). Routes through `fileCoreMemory` (game.js) — the SAME write path as the engine triggers: witnessed-by-all fan-out, per-sheet cap 25 + archive eviction, ★ toast. Subject via `resolveNpcName`; text clamped ~200 chars with loud warn; (turn,kind,who) dedupe = one GM moment per subject per turn |
| `[COMPANION_HP:Name\|+/-N]` | Adjust HP on named party member's `charSheet` (clamped to its maxHp) |
| `[COMPANION_CONDITION:Name\|cond\|dur]` / `[COMPANION_CONDITION_REMOVED:Name\|cond]` | Add/remove condition on companion `charSheet` |
| `[COMPANION_RELATIONSHIP:Name\|entity\|descriptor]` / `[COMPANION_RELATIONSHIP_REMOVED:Name\|entity]` | Upsert/remove relationship on companion `charSheet` |
| `[COMPANION_ITEM_GAINED:Name\|item]` / `[COMPANION_ITEM_LOST:Name\|item]` | Push/filter companion `charSheet.inventory` |
| `[COMPANION_XP:Name\|N]` | Add XP to companion `charSheet`. For INDIVIDUAL bonuses only — shared party XP arrives automatically via the `[XP:]` mirror (the GM is told never to re-emit a shared award) |
| `[COMPANION_ABILITY:Name\|nm\|desc]` | Append ability to companion `charSheet.abilities` (deduplicated) |
| `[COMPANION_ALIGNMENT:Name\|law+1]` | Shift companion `alignLaw`/`alignGood`, recompute `actualAlignment` |
| `[ARC_COMPLETE:title]` / `[ACT_COMPLETE:title]` / `[ARC_CONTINUE:title\|reason]` | **Skeleton lifecycle.** ARC_COMPLETE closes the named active arc (sequential acts auto-activate the next + stamp its pacing clock); ACT_COMPLETE advances the act (parallel acts activate ALL their arcs). `ARC_CONTINUE` (#127) is the OTHER answer to an ARC DRIFT CHECK — the arc is genuinely unfinished: records the reason on the arc, resets that arc's drift clock AND escalation count; active-arc titles only (else warn + no-op). Engine teeth around them (#127, api.js): drift checks escalate to a FORCED `[ARC_COMPLETE:]`-or-`[ARC_CONTINUE:]` fork after two unanswered checks (never auto-closes — the premature-close worry stands), and `buildArcStagingNudge` surfaces a never-introduced active arc every `ARC_DRIFT_RECHECK` turns until a matching `[QUEST:\|offered]` exists (the t1385 finding: three arcs active 507 turns, zero staged). The skeleton block also carries the GM-EYES-ONLY knowledge boundary (characters may only voice what the story has surfaced) |

**Companion tags** all route through `findCompanionChar(name)` in `api.js`, which matches a party member by name (`npc.partyMember && npc.charSheet`). They mutate the companion's `charSheet` object rather than `worldState.character`. The GM is instructed (via `buildSysPrompt` COMPANION SHEET TAGS block + DEFAULT_RULES upkeep rule) to use the `COMPANION_` prefix when an event affects a party member instead of the player.

### 8. Memory / summarization system (in `memory.js`)

`sessionTokens()` estimates the token count of the **unextracted** part of `sessionLog` (sum of `content.length` / 4, counting only messages past the `worldState.sessKept` marker — see tail retention below). When it hits `SUMMARIZE_AT` (globals.js, 2400), `summarize()` fires before the next player action. On failure the log is KEPT and retried next turn; after 3 consecutive failures a raw excerpt is archived as a degraded chapter and the log is trimmed to the retained tail.

`summarize()`:
1. Sends the unextracted session log (from `sessKeptStart()`) to the API with a JSON-extraction system prompt (2000 token limit), plus the current pending-events list under an "ANTICIPATED EVENTS" header (#29)
2. Parses response as `{chapterSummary, npcUpdates[], loreDiscovered[], decisionsMade[], futureEvents[], resolvedEvents[]}`
3. Files everything via `applySummaryExtract(extracted)` (sync, engine-testable): chapter summary → `memory.chapters` + `worldState.eventHistory`; NPC attitudes/knowledge; lore; decisions; then futureEvents in the #29 order — expire → file new → resolve
4. Retains a tail of the just-summarized exchanges and saves memory + core

**futureEvents hygiene (#29):** the GM rarely emits `[FUTURE_EVENT_RESOLVED:]` on its own, so pending events used to accumulate finished business ([history](DOC/CLAUDE_HISTORY.md#8-futureevents-hygiene--the-t198-shalelu-pile-up-29-v1166)). Three teeth, all in memory.js: ① `fileFutureEvent` near-duplicate dedupe — a new event sharing ≥2 significant stemmed tokens (`feTokens`) AND ≥half the smaller fingerprint with an existing pending event refreshes that event's `setTurn` instead of filing a twin; ② `expireFutureEvents()` sweeps unresolved events older than `FUTURE_EXPIRE_TURNS` (globals.js, 40) every summarize — deterministic, no model judgment; unstamped pre-v10 entries are grandfathered (stamped now, age from there); ③ the extractor is handed the pending list and echoes the EXACT text of items the session shows finished into `resolvedEvents[]`, which `resolveFutureEvent` then removes. Resolve runs LAST in `applySummaryExtract` so an event set and finished inside one window nets out removed.

**Summarize-tail retention (#28):** `summarize()` must never clear `sessionLog` to zero — with no verbatim window the GM confabulates recalls ([history](DOC/CLAUDE_HISTORY.md#8-tail-retention--the-t160-pin-grab-28-v1165)). `retainSessionTail()` keeps the newest exchanges (up to `SUMMARY_KEEP_EX`=3 pairs within `SUMMARY_KEEP_TOK`=1600 tokens; the newest pair always survives) as live context, and `worldState.sessKept` marks how many leading messages were already extracted. `sessionTokens()` counts only past the marker (retained tail can't re-trip the threshold — no thrash) and the extraction prompt slices from the same marker (no exchange is ever filed to memory twice). Stale markers (import/clear) fail safe to zero via `sessKeptStart()`. Retrieval side effect: the RAG dynamic skip window (`skipN`, §8b) keys off `sessionLog.length`, so it automatically covers the deeper live window.

Memory status shown in `#membar` as `~NNNtk`: green dot below 80% of `SUMMARIZE_AT`, amber at 80%+, red at/above `SUMMARIZE_AT`.

### 8b. RAG episodic memory (TODO #27 Phase 1 — see [RAG_MEMORY.md](DOC/RAG_MEMORY.md))

Entity-keyed retrieval over the verbatim transcript — no vectors, no extra API calls, **read-side only** (summarize/chapters/caps untouched). **STANDARD BEHAVIOR** — RAG is what carries a long campaign through NPC-key fragmentation + the cap-30 window; validated in the field ([history](DOC/CLAUDE_HISTORY.md#8b-rag--validation-arc-and-pollution-incidents), AUDIT_t308.md). There is no toggle UI; `ragEnabled()` (`worldState.ragMemory!==false`) and the engine-tested explicit-OFF prompt path survive as a diagnosis-only console escape hatch (`worldState.ragMemory=false`), and `migrateWorldState` clears any explicit `false` on load so an OFF flag can never silently stick to a save.

- **Index:** `logTranscript(role,text,raw)` stamps every GM transcript entry with `e:{n:[npcs],l:location,q:[quest titles]}` parsed from the RAW response tags + a known-NPC name scan (`ragEntitiesFromRaw`, memory.js). Pre-Phase-1 entries are lazily backfilled (name-scan only) during retrieval. Additive fields — no schema bump.
- **Retrieval:** `ragRetrieve(input)` (memory.js) scores GM entries by overlap with the current scene (party + NPCs last seen here + location + active quests) ∪ NPCs named in the player's input (weighted highest); skips the last 10 turns (already in sessionLog); picks ≤3 excerpts ≥3 turns apart within a ~600-token budget; renders oldest-first as turn-pair excerpts under a "PAST SCENE EXCERPTS … the CURRENT state blocks above override anything here" header (the stale-chunk drift guard — excerpts are episodic texture, never current truth).
- **Pollution guards:** three exclusions keep false/meta content out of the served set. ① `rc`-marked entries — the `[RETCON:]` tag (see §7) marks the correcting entry + its predecessor at `logTranscript` time; ② **meta exchanges** — GM entries whose player half opens with `"GM:"` (the OOC-question convention) are recall chatter, often confabulated, and can outrank the origin scenes they quote; ③ both exclusions also drop the entries from the IDF document set. Plus the **merge-orphan bridge**: write-time `e.n` names deleted by a later `[NPC_MERGE:]` are re-resolved through `resolveNpcName` (memoized) at scoring time — without it, origin scenes go invisible after a merge collapses their key. Untagged prose corrections from before `[RETCON:]` existed remain indexed — known residual.
- **Injection:** `buildSysPrompt` VOLATILE half only, after ACTIVE NPC DETAILS. Never touches the cached stable block (engine-tested).
- **TOC diet (same flag):** `memoryTOC` filters LORE to scene-relevant + most-recent-8 (cap 12) and drops the CHAPTER SUMMARIES section (duplicates the STORY SO FAR block). **Flag off must reproduce the pre-feature TOC byte-for-byte** — engine-tested; don't restructure the off-path strings.

### 8c. Core Memory (#40; re-homed by #63) — the permanent tier

Core memories live **on the character schema** — `character.coreMemories[]`/`charSheet.coreMemories[]` (`{text, turn, kind, who, camp}`, one sentence each), filed **witnessed-by-all** (user ruling 2026-07-16): every present party member carries the moment on their own sheet, because a witnessed moment is part of each witness's history. This is the PC↔companion interchangeability contract — moments ride `.char` exports, library imports, and `_switchPlayerCharacter` swaps exactly like relationships/conditions/storyBeats (the earlier party-shared `worldState.coreMemories[]` violated it; `migrateWorldState` copies the legacy list to the player + party sheets and DELETES the worldState field — single source, the portrait lesson; [history](DOC/CLAUDE_HISTORY.md#8c-core-memory--the-re-homing-40-v1243--63-v1304)). The **DEFINING MOMENTS** block (`buildCoreMemoryBlock`, api.js) is a VIEW assembled from the party's sheets — same-moment copies dedupe to one line (an unchanged party renders byte-identically to the old shared list); a moment whose `camp` stamp differs from the current campaign (an imported character's carried history) renders attributed to that campaign ("— an earlier adventure") since its turn number is meaningless here. Injected every turn (volatile half, just before REMINDER/STYLE; empty sheets render nothing — byte-identical prompt). Written ONLY by **engine-detected triggers** — `coreMemorySnapshot()`/`detectCoreMoments()` (game.js) snapshot-diff around `applyMuts` at the turn call sites (`sendAction`/`beginAdventure`; `syncCharSheet` deliberately excluded, and the wrapper never touches the parsers). Triggers: HP crossing below max(1, ⌊10% maxHp⌋) for player + companions (crossing = natural hysteresis); companion join/leave; party-member death; weighty `[RELATIONSHIP:]` descriptors (`WEIGHTY_REL_RE`, globals.js). Witnesses = player + living party members with sheets, **plus the subject even off-party/dead** (a departing companion carries their own departure; the fallen carry their death). Cap `CORE_MEMORY_CAP`=25 **per sheet** — overflow evicts oldest near-death to `memory.archive.coreMemories` with a loud warn. Toast (`★ Defining moment`) once per event; read-only "Defining Moments" section on EVERY sheet (player + companions, each their own list; foreign-campaign entries labeled by campaign name instead of turn). The optional `[CORE_MEMORY:subject|text]` GM tag is enrichment on top of the engine triggers, never the foundation: one table entry routing through `fileCoreMemory`, for the engine-undetectable class (revelations — the #57/UA40 finding); its doc line forbids duplicating the engine-trigger classes.

### 9. Map data layer (`memory.map`)

Two-tier location graph stored in `memory.map`: `{nodes:{}, edges:[], lastArrivalFrom:null}`.

**Node keys:** world locations use the plain name (`"Ashfen"`); sub-locations use `"Location|SubLocation"` (e.g. `"Ashfen|The Rusty Flagon"`).

**Node structure:** `{firstVisit:turn, visits:0, description:null, parent:null, npcs:[], items:[]}`. `parent` is `null` for world nodes, or the world location name for sub-location nodes.

**Edges:** `{from, to, turn}` — undirected connection recorded once on first travel between two world locations.

**`worldState.world.sublocation`** — `null` or string, tracking the current sub-location.

**Location items:** `{name, placed:turn, taken:false}`. `taken` is a boolean toggle — `placed` resets it to `false` even if previously taken (item returned). `autoTakeLocationItem()` is called on `[ITEM_GAINED:]` to auto-mark the matching location item as taken.

**NPC last-seen:** `mapNpcLocation(name)` stamps the NPC into the current node's `npcs[]` array and sets `memory.npcs[name].lastSeenAt` to the current node key.

**`buildGeoBlock()`** (in `api.js`) generates a `GEOGRAPHY` block injected into every system prompt turn:
- Current world + sub-location header
- Canonical location/sub-location descriptions
- Items present vs. items previously taken
- Known sub-locations of the current world location
- Arrival direction (`lastArrivalFrom`)
- Connected world locations (from edges)
- NPCs last seen elsewhere (prevents phantom-NPC issues)

`[LOCATION_DESC:]` is stored once (never overwritten) and always re-injected, preventing GM description drift. **State changes live beside it, never inside it (#105/B17):** `node.stateNotes[]` is the append-only record of durable changes (`[LOCATION_STATE:]` tag → `fileLocationState`, memory.js), served in the geo block for the current node and via the always-present `buildChangedLocationsBlock` roll-up for remote nodes — so a place the party materially changed is never again served as intact.

### 10. Combat system

**Multi-foe (UA26)** — design + ratified decisions in [MULTI_ENEMY_COMBAT.md](DOC/MULTI_ENEMY_COMBAT.md). Combat state lives in `worldState.combat`:

```
{ round: N,
  engaged: "name"|null,   // the foe the player last damaged — deterministic "who am I fighting" proxy for bare-tag addressing
  foes: [ { name, hp, maxHp, ac, atk, dmg, morale,
            stats?, immune?, resist?, vuln?,
            down?: "slain"|"fled"|"surrendered" } ] }
```

`[COMBAT_START:]` APPENDS a foe (cap 8; duplicate living name ignored + warn). A foe at hp ≤ 0 or with `.down` set is out of the fight but STAYS in `foes[]` (panel strike-through + GM aftermath context). Named `[ENEMY_HP:Name\|-X]` routes exact-then-contains; bare `[ENEMY_HP:-X]` routes single-living → engaged → first-living + warn (see the §7 rows). Attribute tags (COMBAT_STATS / IMMUNE / RESIST / VULN) bind by positional adjacency to the closest preceding COMBAT_START in the response; no-preceding-start fallback governed by `COMBAT_ATTR_FALLBACK` (tag_table.js). All foes down auto-closes the encounter ("surrender" if any surrendered, else "victory") even without `[COMBAT_END:]`. Legacy single-enemy saves are wrapped into the foes[] shape by `migrateWorldState` (state.js). All mechanics handled by GM through state tags. `#cpanel` shown/hidden by `syncUI()` (`worldState.combat` truthiness).

### 10b. Quest system

Quests are GM-emergent and **player-gated**. Live quests live in `worldState.questLog[]` as `{title, status, desc, objectives:[{text,done}], started}`; finished ones archive to `memory.quests{}`.

**Lifecycle:** `offered → active → completed/failed`, plus `declined`. The GM creates quests via `[QUEST:title|offered|desc]` (toasts "⚑ Quest opportunity"). An offered quest is NOT a goal — the GM may not steer toward or advance it. The player accepts via the **Quest Journal** (Accept button → `acceptQuest(idx)` sets `active`) or by agreeing in-story (GM emits `[QUEST:title|active]`). Decline → `declineQuest(idx)` archives as `declined`. On `completed`/`failed`, `archiveQuest()` moves the quest to `memory.quests` and removes it from the live log; rewards come via the GM emitting `[XP:]`/`[GOLD:]`/`[ITEM_GAINED:]` in the same response.

**Anti-drift:** `buildQuestBlock()` re-injects the authoritative ACTIVE (with objective checklists) + OFFERED blocks into every system prompt — the GM reads quest state from data each turn rather than from its own compressible memory, same pattern as the character sheet. A DEFAULT_RULES entry forbids inventing/renaming/dropping quests and auto-accepting. **Lifecycle teeth (#20):** in mature campaigns the lifecycle goes silent without them ([history](DOC/CLAUDE_HISTORY.md#10b-quest-lifecycle-teeth--the-t198-silence-20-v1172)) — `buildQuestBlock` adds ① a quest-specific "⚑ ALL OBJECTIVES COMPLETE — emit `[QUEST:title|completed]` with rewards, or add the next objective" instruction when every objective is done (deterministically detected), and ② a standing one-line "active crises ARE quests — register unlisted goals now" reminder (present even when the log is empty). Both in the volatile half. `openai.reinforce` includes the quest tags for non-Claude providers.

**UI:** world-state sidebar shows quest titles + a `⚑ N opportunities` indicator; clicking opens `showQuestModal()` — Opportunities (Accept/Decline) · Active (☑/☐ objective lists) · History (completed/failed/declined from `memory.quests`).

### 11. Level-up system

`checkLevelUp()` called inside `applyMuts()` whenever XP changes:
- HP gain per level: `ceil(hd/2) + 1 + CON_mod` (minimum 1)
- Level rows granted from the class bible as NAMED abilities: class rows (2/5/7/9/11/13/15/17) + the committed archetype's rows (3/6/10/14/18 + capstone 20) via classFeaturesAt()/archFeaturesAt()
- **Spell growth (#72 C2, 2026-08-03):** each tier-unlock level crossed (`spellTiers` — full casters T2@5/T3@7/T4@9/T5@11/T6@15, half casters T2@7/T3@9/T4@13, third casters AT/EK on their archetype schedule T1@3/T2@10/T3@14/T4@18) queues a forced-choice picker (`showSpellUnlockModal`, `SPELL_UNLOCK_PICKS` counts, bench-only pool, base-name dedupe) after the archetype/stat-bump modals; owed picks re-surface before the next turn like owed bumps. Companions AUTO-pick silently (first N unknown bench spells). Fill-phase blank benches skip loudly. No retroactive grants — only unlocks crossed by the level change fire
- Level 3: `showArchetypeModal()`
- Levels 4, 8: `showStatBumpModal()` (+2 to one stat or +1 to two, max 20)

`checkCompanionLevelUp(cs)` called from the `[COMPANION_XP:]` handler — companions auto-level silently (HP gain + class features, same formula) with a toast and system message, but no archetype or stat-bump modals.

**First-encounter memory:** the first time an NPC enters `memory.npcs` via `[NPC:]` or `[PARTY_MEMBER:|true]`, a `firstEncounter` snippet is stored — the cleaned response prose with the trailing suggestion line stripped, cut at a sentence boundary (~280 chars max), computed once per response (lazy). Written once, never overwritten; preserved across `[NPC_MERGE:]`. Injected as "First met:" in `memoryNpcDetail()`.

### 12. Alignment drift

`character.alignLaw` and `character.alignGood` are integers clamped to [-3, 3]. `alignLabel(law, good)` maps to 9-point grid. GM shifts via `[ALIGNMENT:]` tags.

### 13. Rendered action suggestions (decoupled — #14)

Action suggestions are **fully decoupled from GM prose**. The GM writes pure narrative — no `[ACTIONS:]` tag, no `*You could…*` line. The STYLE block explicitly tells the GM NOT to emit action suggestions.

**Flow:** after the GM response renders, `generateActions(msgEl)` in `game.js`:
1. Creates 3 placeholder `"…"` buttons (disabled) appended to the narrator message element
2. Fires a follow-up `callGM` call (200-token output budget) asking for 3 short action options as a JSON array. The call reuses the main turn's FULL `buildSysPrompt()` — stable half passed BYTE-IDENTICAL (rides the turn's still-warm prompt cache at the 0.1× read rate; engine-tested, a perturbed stable silently kills every hit) with a `SUGGESTION_MODE_BLOCK` appended to the VOLATILE half only (after STYLE, so the JSON-output instruction wins the format fight) — plus the last 5 exchanges as labeled `Player:/GM:` pairs (`suggestionHistoryPairs`, ~6k char budget, newest always survives). Runs on the ACTIVE gameplay model (caches are model-scoped; no model escalation on this call — `upgradeModelFor()` survives for the skeleton only). A starved mini-prompt version of this call shipped canon-violating buttons — never regress it ([history](DOC/CLAUDE_HISTORY.md#13-suggestions--the-starvation-arc-14--v1288)). ⚠ User watch flag 2026-07-12: if prose voice/cost/cache health ever seems off, suspect this call first (Usage modal → actions In/call + cache-health lines).
3. Parses the response via `parseSuggestionArray` (tolerates fenced and prose-wrapped arrays), populates each button's text and `data-action`, enables them
4. Stores the options in `worldState.lastActions` via `saveAll()` for reload persistence
5. On failure, silently removes the placeholder buttons (console-warned)

**Reload:** `init()` and `campLoad()` check `worldState.lastActions` first and build buttons via `buildActionButtons(acts)` (returns HTML string). Falls back to `parseActions(clean, raw)` for pre-v1.110 saves that still have the `[ACTIONS:]` tag embedded.

**`parseActions`** (api.js) is retained only for legacy save replay — reads `[ACTIONS:]` tag primary, then `[a|b|c]` without prefix, then the old `*You could…*` prose-parsing. No new responses use it.

- Buttons rendered as `<button class="qa" onclick="sendSuggestedAction(this,event)" data-action="…">`. Tap fills the input (converted to 1st person via `toFirstPerson`, #14a); long-press / Ctrl-click sends (#14a).

### 14. Table Talk mode

Implemented as a **tab** (not a checkbox). `activeChatTab` global is `"narrative"` or `"tabletalk"`. `switchTab(tab)` toggles visibility of `#story-narrative` / `#story-tabletalk` and updates tab button styles. `addMsg` routes by message type. A blue badge dot appears on the inactive tab when a message arrives there. `isTT` in `sendAction` is derived from `activeChatTab === "tabletalk"`.

### 15. File menu

Present on both `#game-screen` (in `#topbar`) and `#char-screen` (top-right above step dots).

**Submenu presentation:** drawers open as **side flyout panels on desktop** — the toggle measures the parent item's rect BEFORE opening and flies toward whichever side of the screen has more room (away from the closest edge; leftward is the CSS default, rightward the inline override). At ≤768px they fall back to the **inline accordion** — positioning lives on the `.fm-subwrap`/`.fm-sub` CSS classes (index.html), open/closed state is the inline `display` the JS toggle flips. Flyouts reset closed whenever a File menu opens (`resetFileSubmenus`).

**Game screen items (cascading drawers):** Sync state (mobile), World state (mobile), Render prompt (mobile) | Campaigns… | Car Mode | **💾 Save / Load ▶** (Save Game, Load Game, Export Character, Import Character, Export as Blueprint, 📜 Export Narrative) | ☁ Blueprint Library… | **⚙ Admin ▶** (Voice Settings…, **📖 Narrative options ▶** (Narrative rules, ✍ Prose inspiration…, 18+ Adult content), Language Model…, 📊 Usage & cost…, Render Options…, Large text, Auto-send voice, Legacy characters, campaign folder, Connect/Disconnect server, Clear cache) | Clear cache & reload | New Game. Cascading toggles share one wiring loop in `wireButtons` (`devmode/devmenu`, `saveload/saveloadmenu`, `narropts/narroptsmenu` — narropts nests inside Admin). **The Blueprint Designer has NO menu entry by user preference** — open `blueprint-designer.html` directly.

**Char screen items:** Same full list, but Sync state, World state, Render prompt, Save Game, Export Character, and New Game are greyed out (`opacity:0.4; pointer-events:none`) — no active game yet.

Both menus share the same underlying functions. `updateServerUI()`, `loadAdultMode()`, and `toggleAdultMode()` sync state across both menus simultaneously.

**File naming:** `buildFilename(type)` — format `[campName]_[charName]_t[turn].[ext]`. `worldState.campName` is set once at campaign creation and never changes.

(There is no auto-export narrative — `worldState.transcript` is the complete cross-device narrative record and the memento/story compiler #5 reads from it.)

### 16. Campaign management

`showCampaignPicker()` reads `tnd_camps_v1` from localStorage. `saveAll()` calls `storageAdapter.syncToServer()` on every save — **debounced**: schedules a trailing 1.5s timer so a turn's multiple saveAll bursts coalesce into ONE `POST /api/state` built from the latest state. `storageAdapter.syncNow()` flushes immediately; wired to `beforeunload` and `visibilitychange(hidden)` so closing/backgrounding can't drop the final turn. The payload no longer carries the story DOM (`narrativeHtml` is sent as `""`) — replay rebuilds from `worldState.transcript`.

After connecting to server, `syncCampaignList()` fetches the server campaign list and merges it into `tnd_camps_v1`, then the campaign picker opens automatically.

### 17. Sync modal

Direct editing of HP, max HP, gold, XP, level, location, time, weather, inventory without going through the GM.

### 18. Render feature

`doRender()` calls the **fal.ai** API. Three models selectable via Render Options modal (in Dev Mode):
- **Flux Dev** — `fal-ai/flux/dev` (text-to-image) / `fal-ai/flux/dev/image-to-image` (img2img, default strength 0.6)
- **Nano Banana 2** — `fal-ai/nano-banana-2` / `fal-ai/nano-banana-2/edit` (img2img via `image_urls`; edit-style API, no strength knob)
- **Qwen Image 2512** — `fal-ai/qwen-image-2512` / `fal-ai/qwen-image-edit/image-to-image` (img2img, default strength 0.9 — edit-style model returns near-copies at 0.6)

**img2img strength is user-tunable (#42):** each model's `img2img` entry declares its `strength` default as data (body fns take it as a param); `img2imgStrength(cfg)` (helpers.js) resolves the player's per-model override (Render Options ▸ "Portrait influence" slider, 0.2–0.95, persisted in `RENDER_STR_K`) over the default, returning `null` for knobless models (slider hides). Only the scene render (`doRender`) reads it — portrait-generation paths keep their fixed 0.75.

When `character.portrait` exists, img2img is used automatically (status line shows "Generating scene (portrait-seeded)…"). Falls back to text-to-image if no portrait.

Parameters: `aspect_ratio:"4:3"`, `resolution:"1K"`. `genderWord` derived from `c.gender` (male/female/androgynous).

### 19. Portrait system

`character.portrait` — null or base64 data URL. Compressed via `compressPortrait()` (Canvas resize to max 400×600px, JPEG 0.8) before storage to avoid localStorage quota overflow.

Set from three paths:
1. Scene render → portrait button on render output
2. Portrait modal → "Use as Portrait" button
3. Portrait modal → file upload

**Pan + zoom:** `character.portraitOffset = {x, y, zoom}` — x,y are 0..1 (fraction of pannable overflow), zoom ≥ 1. Rendered by `applyPortraitTransform(img, off)` (transform: translate+scale, applied post-load since it needs natural dims), NOT `object-position` (intra-element — it can only pan the single cover-overflow axis; a landscape image in the portrait oval overflows horizontally only, so vertical pan needs zoom to create slack). `wirePortraitDrag()` does drag-pan + wheel/pinch zoom + exposes `img._zoomBy(factor)` for the modal's +/− buttons. `normPortraitOff()` upconverts legacy `{x:0..100}` object-position saves. The player char-sheet avatar, **companion char-sheet avatars**, and the portrait modal all use the offset; small NPC/list/party-HUD avatars stay center-cropped.

**Companion portrait single-source:** an NPC's portrait lives in ONE place — `charSheet.portrait` when a sheet exists (rides inline in the sync blob), `npc.portrait` only for sheet-less NPCs (separate `/portrait` store). All display reads go through `npcPortrait()` (helpers.js, charSheet-first with `npc.portrait` fallback for unmigrated saves); `migrateWorldState` drops the old duplicate. **Transport:** the `/portrait` store collectors read via `npcPortrait()` (single-home images still upload for PV-path edits), and `fillPortraitsFromBlob()` (storage-adapter) runs on every server reconcile regardless of the turn/PV gates — fill-only, landing blob-borne charSheet portraits on devices already at the current turn (without it, equal-turn devices have NO portrait transport at all). Cross-device desync history: [history](DOC/CLAUDE_HISTORY.md#19-portraits--the-sync-sagas).

**Companion offset:** stored per-companion on `wsNpc.portraitOffset` and mirrored onto `wsNpc.charSheet.portraitOffset` (so it survives promotion-to-PC). ⚠ `showNpcSheet` wires `wirePortraitDrag` on `#npc-portrait-img` via `wireNpcAvatarDrag()` and MUST pass `getOffset`/`setOffset` into `showPortraitModal` — without those the modal's defaults fall back to `worldState.character`, silently rewriting the PLAYER's framing while editing a companion. Portraits generate at **3:4 portrait aspect** via `portraitRenderBody()` (overrides the render model's landscape default; scene renders untouched).

### 20. Character sheet modal (`#cs-modal`)

Opened via **Sheet** button in topbar (desktop) or File menu (mobile). Built by `showCharSheet()`.

**Visual style:** `rgba(0,0,0,.88)` overlay, inner `#181818` box with `1px solid var(--acc)` amber border, `border-radius:12px`, `max-width:560px`. Click outside or × to close.

**No pill/chip borders anywhere** — all data rendered as plain text. Commas separate list items. Used spells get `text-decoration:line-through` + dim color. Broken languages shown in amber with `(broken)` suffix.

**Sections:** Hero card · Attributes · Character (trait/flaw/motivation/backstory) · Conditions · Relationships · Languages · Save Modifiers · Skills (earned only) · Story Beats · Abilities · Spells · Inventory

**⟳ Sync button** (header, beside Export Character) calls `syncCharSheet()` in `game.js`. It sends an internal GM audit prompt (not a player turn) asking the GM to emit ONLY state tags for anything missing or changed on the player AND every party member — using `COMPANION_*` tags for companions. The prompt enumerates each party member by name. Response passes through `applyMuts()`; the sheet then closes and reopens. Gated by `busy`; uses a 500-token budget. Provides a manual fallback for older sessions where the GM didn't emit upkeep tags inline.

### 21. NPC alias system

`resolveNpcName(name)` in `memory.js` resolves aliases to canonical name before any storage op. All NPC-keyed tags resolve aliases: `NPC`, `NPC_PRONOUN`, `NPC_NOTE`, `PARTY_MEMBER`, `RELATIONSHIP`, `RELATIONSHIP_REMOVED`. NPC list in system prompt shows `Name [aka: alias1, alias2]`.

### 22. Cloud sync (`storage-adapter.js`)

**Server:** `https://traffic-and-dragons-server.fly.dev`
**Auth:** GitHub OAuth popup → server postMessages `{type:"tnd-auth", sessionId, username}` back to opener → token stored in `tnd_server_tok_v1`.
**CORS:** Server uses `origin: function() { return "*"; }` to handle `null` origin from `file://` pages.
**Endpoints:** ~20 routes — full enumeration in [SERVER_ARCHITECTURE.md](DOC/SERVER_ARCHITECTURE.md) §1.2 (auth: `/auth/github` + callback + `/auth/done` + one-shot `/auth/ticket/:ticket` + `/auth/me` + logout; state: `GET/POST /api/state` (POST carries the CAS turn guard), `GET/DELETE /api/campaigns[/:id]`, `PUT /api/campaigns/:id/portrait`; libraries: `/api/characters`, `/api/blueprints`; prefs: `GET/PUT /api/prefs/:key` (#95.5 — allowlisted account-level blobs, `speaker_stars` = the cross-device star bench); `GET /health`). Auth flow is TICKET-based: the popup postMessages a one-shot ticket (or the opener polls it on file://), and the sessionId comes from the claim endpoint.
**Deploy:** `cd C:\Users\hannu\Projects\traffic-and-dragons-server && flyctl deploy --ha=false` — the server repo lives OUTSIDE the OneDrive-synced tree (DOC/PROJECT_ONE_DRIVE_EXODUS.html Phase 4); it is NOT a sibling of the game repo.
**TTS app (#90, M1):** `https://tnd-tts.fly.dev` — a SECOND Fly app in the same server repo (`tts/` subdir; deploy `cd tts && flyctl deploy --ha=false`). `POST /api/tts` {text, voiceId, rate} → audio/wav (warm piper daemons, LRU 3, 10min idle kill; voices HF→3GB volume on first use); auth = the game server's session token proxy-validated via `/auth/me` (10min memo); `/health` unauthenticated (the client's prewarm probe — wakes the auto-stopped machine). Design: DOC/DOC_server_tts.html; Kokoro M2 is TODO #91 (benchmark-gated).

### 23. Reload behavior

On `init()`, if a saved game is found, `rebuildNarrativeFromTranscript()` (ui-boot.js) repaints the last 20 `worldState.transcript` entries into `#story-narrative` (with an "earlier entries omitted" note when trimmed); the last response's suggested action buttons (`worldState.lastActions`) are live and clickable. The same rebuild serves campaign loads and the server reconcile (`clearFirst=true` there). Fallbacks for pre-transcript saves: last sessionLog exchange, else a "Previously:" chapter recap, else legacy `narrativeHtml` from old server blobs. Dice blocks and system messages are not replayed (the transcript stores story prose only, by design).

---

## Conventions

- **ES5.1+ JavaScript** — `var`, no arrow functions, no template literals, no `const`/`let`. `async/await` only in the three API-facing functions. ES5.1 builtins (`.forEach`, `.map`, `.filter`, `Object.keys`) and `Object.assign` (ES6, universally supported) are permitted.
- **Single-character variables** common in dense utility functions.
- **HTML built by string concatenation** — no templating engine.
- **State versioning via key suffix** — all storage keys end in `_v10` (campaigns in `_v1`).
- **No front-end dependencies** — CSS and JS entirely self-contained.
- **CSS variables** for theming — palette in `:root`, amber accent `--acc` (#b8935a) is the visual identity color.
- **Modals always created fresh** — remove prior instance by ID before creating new one.
- **`busy` flag** — global boolean gates all API calls. Always set `busy=false` in both success and error paths.
- **Scrollbars** — custom styled via `::-webkit-scrollbar` rules: 6px wide, near-black track, dark grey thumb, amber on hover.
- **No pill/chip borders on non-interactive elements** — use plain text, comma-separation, or `cs-list-row` rows instead. Borders imply clickability. ONE sanctioned exception: the verdict-badge standard below, for doc/satellite pages only.
- **Verdict/status badge standard (user-approved 2026-07-12)** — when a doc/satellite page needs a colored verdict or status badge (pass/fail/warn, wins/loses, etc.), use the muted-fill pill from `DOC/app_vs_browser.html` (`.lean` classes), NOT an outlined pill or a full-brightness fill (both tried and rejected — outline reads thin, solid fill kills the text). Recipe: background = the accent color cut to **20% of its HSV value** (e.g. `--good` `#7aa86a` → `#182215`), 1px border in the **full-brightness** accent (the rim is what carries the color), text **bold monospace, uppercase, `rgba(255,255,255,.4)`**, `border-radius:12px; padding:2px 10px; font-size:.78em; letter-spacing:1px`. Game-UI surfaces keep the no-pill rule above.
- **`DOC/` holds reference docs — HTML and MD.** Reference material and completed-project records live there; audits live in `audits/`; satellite TOOLS (bible_study.html, bible_editor.html, blueprint-designer.html, bug_tracker.html, author_voice_lab.html, test.html, piper_test.html) stay at root. **Three docs stay at root by design** — `CLAUDE.md`, `TODO.md`, `todo_checkWithFable.md` (the daily working set; `dev/lint-todo.js` also hardcodes `../TODO.md`). Sample `.blueprint` fixtures live in **`samples/`**; personal `.tnd` saves live in **`testRuns/`** (gitignored) — a save cited by an audit must keep its link working, so move the citation in the same commit.
- **Trackers — one job each (consolidated 2026-07-29):** open work lives ONLY in **`TODO.md`** (single source of truth; update the row in the same commit as the fix). **`DOC/BUGS.md`** = field-report pipeline only (the /bugs contract). **`todo_checkWithFable.md`** = the Fable-review queue: pending entries + a verdict index; full review records archive to `audits/FABLE_REVIEW_RECORDS.md`. **While the Fable budget is exhausted, ALL Opus work is documented there** (user rule 2026-07-29) for one-pass triage when it renews. **Session handoffs are ephemeral** — there is no standing `HANDOFF.md`; when a session writes one, its open items merge into TODO.md and the file archives as `DOC/HANDOFF_v<ver>.md` when superseded. Completed reviews/audits live under `audits/`.
- **No surface is allowed to be untestable, and no guard is trusted until sabotage proves it** (2026-07-29; origin story in [history](DOC/CLAUDE_HISTORY.md#the-2026-07-29-bible-editor-spiral-origin-of-the-guardrail-rules)). The rules and tools:
  1. **If a surface can't be driven by `dev/run-tests.js`, the first commit that touches it adds a seam.** "I can't click the button" is almost never true — buttons call functions, and functions can be called (the bible editor's seam is `window.__bibleTest` + an OPFS `FileSystemFileHandle`: real handle, no picker, no gesture). Satellites with logic (`bible_editor`, `blueprint-designer`, `bug_tracker`) each need one; only the bible editor has it so far.
  2. **Prove every contract clause with `dev/sabotage.js`, and treat a mutation that changes no bytes as a FAILURE.** A green clause guarding nothing is worse than no clause. The harness restores the file on exit, crash and Ctrl-C, and asserts byte-identical restoration.
  3. **`dev/file-forensics.js <file>` before the second theory.** One command prints size · mtime/ctime · permissions · BOM · line endings · parses-or-not · tracked/HEAD-size/status · `.crswap` and temp siblings · current write-lock, and exits non-zero on anomalies. When an error asserts a fact, verify that fact exhaustively before reinterpreting it.
  4. **`dev/install-bible.js`** is the reliable bible workflow while the editor's in-place save is unproven: edit → ⬇ Download copy → `node dev/install-bible.js`. It validates (parses, 9 classes / 234 slots / 20-level XP curve, lowercase capability keys) and **refuses an empty file**.
- **File menus are GENERATED, not hand-written** — `buildFileMenus()` (ui-boot.js, called first in `wireButtons`) renders all three File menus (`#file-menu`/`#cs-file-menu`/`#api-file-menu`) from ONE spec. To add/move/remove a menu item, edit the spec in `buildFileMenus` — never touch index.html (the mount divs there are empty). Ids keep the `fm-`/`cs-fm-`/`api-fm-` prefixes (import inputs: `""`/`cs-`/`api-`), so all existing id-based wiring works unchanged. Per-surface differences (disabled items on char/API screens, mobile-only quick actions on the game screen) are flags in the spec.

---

### 24. Character library (`storage-adapter.js` + server)

Server-side character storage separate from campaigns. Characters are portable snapshots — exporting Ammut at Lv3 stores a Lv3 version; campaigns have no dependency on this store.

**Server table:** `characters (user_id, slug, name, char_data, level, cls, ancestry, updated_at)` — composite PK `(user_id, slug)`. One slot per character name per user.

**Server endpoints:**
- `GET /api/characters` — list all characters for user (includes full char_data with portrait)
- `POST /api/characters` — upsert by name slug; body: `{character}`
- `DELETE /api/characters/:slug` — remove from library

**Client methods on `storageAdapter`:** `listCharacterLibrary(cb)`, `saveCharacterToLibrary(char, cb)`, `deleteCharacterFromLibrary(slug, cb)`

**Export flow:** "Export Character" button (char sheet + companion sheets) opens `_showCharExportOptions(char)` — offers "☁ Save to library" (grayed if not connected) and "⬇ Download .char file". If saving and character already exists in library at a different level, `_showCharOverwriteConfirm` asks before overwriting.

**Import flow:** `showCharacterLibrary()` browser modal — lists saved characters with portrait, Import (→ `showCharImportPreview`) and × delete buttons. Accessible via the "☁ Character Library" button in the Import Character browser.

**"Play as X" flow:** all three import paths (file, campaign browser, library) route through `_startImportedCampaign(char)` — a campaign-setup modal asking campaign name, world tone, and starting location (options cloned from the wizard's Review-step select) before resetting state and calling `startGame()`. The character is played as-is; companions are added in-game via Import Character → Add as companion (intro instruction sent via `sendAction(intro,{silent:true})` so it never renders as a player message).

**Mid-game character swap:** `_switchPlayerCharacter(name)` (NPC sheet → "Play as this character") demotes the current PC to a companion NPC and promotes the chosen companion's `charSheet` to `worldState.character`. The POV-handoff problem (GM kept narrating the old PC as "you") is fixed two ways: (1) the handoff message is a forceful out-of-character control directive ("the player now controls X; second-person = X; old PC is now third-person"), sent `{silent:true}`; (2) `worldState.recentSwitch = {to, from, turn}` makes `buildSysPrompt` re-inject a "CONTROL RECENTLY SWITCHED" block that explicitly discounts the sessionLog momentum, auto-cleared in `sendAction` after 2 turns (same transient-marker pattern as `pendingLegacy`). The system-prompt re-injection is the load-bearing part — a single handoff line can't overpower many turns of old-POV conversation history. **Portrait atomicity:** `syncToServer` must never null `character.portrait` — the current PC's portrait rides **inline in the main state blob**, atomic with the state turn, so it can never be the former PC's. Only sheet-less NPC `n.portrait` is stripped to the separate `/portrait` store. `markPortraitDirty()` is retained for NPC portraits; the load-side `data.portrait` fallback migrates older blobs that still have a null PC portrait. (Desync history: [history](DOC/CLAUDE_HISTORY.md#19-portraits--the-sync-sagas).)

---

## Known issues

- **Local folder rename pending** — `dnd_rpg` → `traffic-and-dragons` (do in Explorer before opening Claude Code; then update hardcoded paths in `.claude/settings.local.json` and `.claude/hooks/stop-check.js`)
- **"↩ Import existing campaign" on tone step** — redundant with File menu; consider removing

(Resolved issues with their diagnosis records live in [DOC/CLAUDE_HISTORY.md](DOC/CLAUDE_HISTORY.md).)

---

## Feature backlog & decisions

See [TODO.md](TODO.md) for the full task list, known issues, and architecture decision log.

---

## Dev workflow

**Running locally:**
1. Open `index.html` directly in any modern browser (Chrome, Firefox, Edge).
2. Enter your Anthropic API key (`sk-ant-...`) on the opening screen.
3. The key is stored in `localStorage` under `tnd_ak_v1` and auto-loaded on subsequent visits.
4. No build step, no `npm install`.

**Testing changes:**
- Hard-refresh (`Ctrl+Shift+R`) after editing any `.js` file — Chrome caches aggressively.
- **Service worker (`sw.js`)**: **cache-first with network fallback.** Safe ONLY because the `CACHE` constant is bumped on every deploy (hard rule) and browsers fetch the SW script fresh per navigation — so a bump is always detected: `install` precaches the new shell, `activate` deletes the old cache, `skipWaiting`/`clients.claim` flip it on the next load. Net: ≈zero asset bandwidth between deploys, one shell download per device per deploy, ~1-navigation lag before a new version shows. (Network-first was tried and reverted — it blew through a bandwidth cap and paused the site; [history](DOC/CLAUDE_HISTORY.md#swjs-caching--the-full-arc).) If a browser seems stuck, File → Clear cache & reload is the manual escape hatch. When testing locally on `localhost`, the SW also intercepts — unregister via DevTools → Application → Service Workers (or hard-refresh) if files look stale.
- Always test on **Cloudflare Pages** after `git push` — `file://` and the deployed site can have different cached files. (Hosting: Cloudflare Pages — pure static, no build command, output dir = repo root; `_headers` controls cache; unlimited bandwidth.)
- Use the **Sync** button in-game to manually patch world state.
- Use **Table Talk** tab to query the GM out-of-character while debugging.
- Wipe state: DevTools → Application → Local Storage → delete all `tnd_*` keys, or use **New Game**.
- **Export save** before testing risky changes.
- **CI test gate:** `.github/workflows/engine-tests.yml` runs `node dev/run-tests.js` (the full assertion suite + every source contract) on every push and PR — the local pre-commit hook is no longer the only enforcement (review 2026-08-01).
- **Automated playtest harness** (`dev/playtest-harness.js`, not loaded by `index.html`) — drives N real GM turns against a throwaway character via `preview_eval`, for (1) smoke-testing invariants (combat panel clears, summarization fires on schedule, no console errors) and (2) collecting a narration corpus to judge prose-voice/content-DNA drift over a long run against a chosen author. Usage instructions are in the file header. Ops: the `/playtest` skill.

**Diagnosis & verification discipline** (origin sagas in [history](DOC/CLAUDE_HISTORY.md#the-v027v028-textarea-saga-origin-of-the-diagnosis-discipline)):
- **Verify the FAILURE condition, not a benign case.** A check that can't fail proves nothing. For "3 lines, no partial" the test input is a field that *overflows*; for a parser, the malformed input; for a cap, the over-limit case. Pick the input that would break it — long/empty/boundary/the exact thing reported — and exercise that.
- **For visual/layout work, the screenshot is ground truth; measurements (`getComputedStyle`, `clientHeight`) are a proxy.** When the number and the render disagree, believe the render and go find *why the number lied* (the box the spec measures is not always the box the scroll paints). Don't let a passing metric override the eye.
- **"Measures fixed but reported still broken" → reproduce before you explain.** Treat that gap as the clue, not noise. Never let "cache/environment" be the first explanation for a divergence you haven't reproduced under the user's exact conditions. A user's "confirm it visually" is usually correct — honor it.
- This is the same lesson as **test-first on engine changes**: writing the failing assertion first forces you to define and exercise the break before shipping. Caveat: headless `dev/run-tests.js` can't see CSS layout, so for **visual** bugs the "test-first" equivalent is a scripted `preview_eval` that sets up the edge/overflow case AND screenshots it — not just reads a computed style.

**Drift-protection change policy (user decree 2026-07-09):** the anti-drift stack is the product's core, validated value; its failure modes are SILENT (degraded canon, dead cache, fused NPCs). **The drift surface:** `applyMuts` write paths · all memory tiers (summarize / RAG / memoryTOC / futureEvents / alias-resolution / NPC merge) · `buildSysPrompt` canon-injection blocks, the stable/volatile cache split, and STYLE-at-end position · `cleanTxt` + the tag vocabulary + the STATE TAGS prompt docs · transcript integrity (`serializeWorldState`/`parseWorldState`) · quest/skeleton lifecycle teeth. **Any task touching this surface, however small: Tier = Fable (never hand it to a lighter session, even if it looks mechanical), a critical review of the task BEFORE any code — consider what it touches, what silent failure it could cause, and the test plan, examined from alternate angles; present to the user ONLY if a confident solution can't be resolved (amended 2026-07-12 — a confidently-resolved review is recorded in the commit/tracker row instead, and genuine design forks still go to the user) — and thorough verification AFTER (engine tests + stable-half byte-identity + prompt/mutation diff against real transcripts + live spot-check where warranted).** See Fable_UberAudit.md ▸ "Standing policy" for the per-task guard notes.

**Standing audit dimension (2026-07-17, the r8/jetsam lesson):** every audit includes a **monotonic-resources pass** — enumerate everything that accumulates (JS-side AND inside vendored wasm deps) at per-call / per-turn / per-session scope; a prior fix's retained singleton is not exempt; second instance of a failure class → enumerate the class, don't ship a third point-fix; memory-class verification = duration (piper_test.html soak mode), not a single input. Full text: Fable_UberAudit.md ▸ "Standing audit dimension — monotonic resources".

**Version number:**
- Current: see `APP_VERSION` in `globals.js` — never hardcode the number in docs (it rots).
- Constant `APP_VERSION` in `globals.js` — consumed by `updateMemStatus()` (session bar) and injected into all three File ▾ menu version labels via `_menus` loop in `wireButtons()`.
- **Bump `APP_VERSION` on every commit that changes game code** — no exceptions. Also bump `CACHE` in `sw.js` on the same commit. This is how you confirm the right version is deployed.
- **ONE carve-out: the Blueprint Designer versions separately** (user call 2026-07-05). `BP_DESIGNER_VERSION` in blueprint-designer.html — bump IT on designer-only commits, and do NOT bump `APP_VERSION`/`CACHE` for them (the designer isn't in the SW app shell). A commit touching BOTH designer and engine files bumps both. The designer header shows `v0.x · engine v1.y` because blueprint schema compatibility tracks the engine.
