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
| `index.html` | **Active host** | CSS, HTML scaffolding, 34 `<script src>` tags, no inline JS |
| `globals.js` | ✅ Extracted | `apiKey`, `busy`, `lastAction`, `panelCol`, `secCol`, `activeChatTab`, `pendingChar`, `pendingSpellPool`, `pendingBumps`, `currentBump`, `rvGold`, `customRules`, `RENDER_MODELS`, `pendingCompanions` |
| `wasm-probe.js` | ✅ Active (B9) | WebAssembly linear-memory probe — hooks the wasm instantiation entry points at load (must run before any wasm exists), making ORT's otherwise-invisible linear-memory growth measurable. Loaded by BOTH index.html and the Piper synthesis iframe |
| `error-report.js` | ✅ Active (#16) | Mobile error reporting — `reportError(ctx,msg,detail)` POSTs runtime errors to a Google Apps Script webhook that emails pmegow@gmail.com (the mobile console is invisible. → [full contract](DOC/contracts/satellites.md#error-reportjs) |
| `compress.js` | ✅ Active | Self-contained LZ-string UTF-16 compressor (`LZ.compressToUTF16`/`decompressFromUTF16`, public-domain LZString, no deps) — compresses ONLY the transcript at the localStorage boundary (see §3 transcript compression); loads right after error-report.js in the SW app shell and the headless test runner |
| `data.js` | ✅ Extracted | Game data constants (TONES, ANCS, SPELLS, ARCH_SPELLS, STAT_BUMP_LEVELS, DEITY_MAP, DEITY_CENTRIC, DEFAULT_RULES, SPELL_PICK_LIMITS, SKILLS, SKILL_LEVELS, SKILL_THRESHOLDS). → [full contract](DOC/contracts/character.md#datajs) |
| `capability_bible.js` | ✅ Active | The unified `capability_bible` (#10) — `CAPABILITY_BIBLE` holds spells AND abilities (`kind` is cosmetic, `cost`+`isMagical` are the real axes). → [full contract](DOC/contracts/items.md#capability-biblejs) |
| `helpers.js` | ✅ Extracted | Utility functions: `smod`, `skillLevel`, `initSkills`, `alignLabel`, etc. Plus `bibleCardHTML(name,entry)` (TODO #10) — the shared pure capability-card renderer used by BOTH the in-game click-card and `bible_study.html` (one render, two hosts) |
| `state.js` | ✅ Extracted | `store`, `worldState`, `sessionLog`, `memory`, save/load functions, storage key constants |
| `storage-adapter.js` | ✅ Extracted | Cloud sync: `loginWithServer`, `syncToServer`, `syncCampaignList`, `loadFromServer`, `logoutFromServer`, `listCharacterLibrary`, `saveCharacterToLibrary`, `deleteCharacterFromLibrary`; `authHeader()` (#90 — the assembled Authorization header for the tnd-tts app, never the raw token) |
| `memory.js` | ✅ Extracted | `sessionTokens`, `fileNpcEvent`, `fileLocation`, `fileLore`, `fileDecision`, `fileFutureEvent`, `resolveFutureEvent`, `memoryTOC`, `memoryNpcDetail`, `summarize` |
| `clock.js` | ✅ Active (#73) | The CAMPAIGN CLOCK — ONE monotonic scalar `worldState.clock.min`. → [full contract](DOC/contracts/clock.md#clockjs) |
| `identity.js` | ✅ Active (#156) | ⛨ **THE IDENTITY LAYER spine** — `IDENTITY_DOMAINS` registry (npc = full adapter. → [full contract](DOC/contracts/identity.md#identityjs) |
| `tag_table.js` | ✅ Active (UA1) | ⛨ **THE tag registry** — one ordered table (`TAG_TABLE`, ~57 handlers) from which three formerly hand-synced surfaces DERIVE: `applyMutsTable()` (THE parser), `buildCtTags()`/`buildCtBare()` (cleanTxt's strip regexes), and `buildStateTagsDoc()` (the STATE T… → [full contract](DOC/contracts/tags.md#tag-tablejs) |
| `api.js` | ✅ Extracted | `callGM`, `buildSysPrompt`, `getRulesBlock`, `applyMuts` (a thin veneer — `applyMutsTable()` + `__tagUnknownScan()`; the legacy parser is deleted), `findCompanionChar`, `cleanTxt` (regexes derived from tag_table), `diceTxt`, `parseActions`, `buildGeoBlock` |
| `table-talk.js` | ✅ Active (#76) | The Table Talk HELP AGENT — an out-of-character help desk answering factual questions about the app, the rules, and this campaign's own history. → [full contract](DOC/contracts/prompt.md#table-talkjs) |
| `campaign_generator.js` | ✅ Active (#59) | ⛨ Shared campaign-skeleton generator + one-pass review serving TWO consumers: `game.js generateSkeleton()` (freeform campaign start gets ONE review pass + auto-correction. → [full contract](DOC/contracts/character.md#campaign-generatorjs) |
| `char-creation.js` | ✅ Extracted | All wizard step logic, `cs`, `confirmChar`, archetype/spell/stat-bump pickers |
| `game.js` | ✅ Extracted | `sendAction`, `sendSuggestedAction`, `beginAdventure`, `retryLast`, `checkLevelUp`, `showArchetypeModal`, `pickArchetype`, `showStatBumpModal`, `restSpells`, `doRender`, `newGame`, `syncCharSheet`, `checkLegacyCharacter`, `checkCompanionLevelUp` |
| `ui-*.js` (×10) | ✅ Split (#54) | ui.js decomposed per [UI_SEAM_MAP.md](DOC/UI_SEAM_MAP.md), load order below. One job per file: |
| `ui-shell.js` | ✅ | toasts, screen switching, message log (`showToast`, `addMsg`, `showGame`/`showChar`, `switchTab`, `closeAllMenus`) — loads first; called by nearly every other file |
| `ui-panels.js` | ✅ | `syncUI` + the live panels (HUD, party, quest, inventory/abilities/spells, combat, membar + the #17 drift-health dot, sync badge) |
| `ui-portrait.js` | ✅ | portrait pan/zoom/drag, `compressPortrait`, `showPortraitModal` (the fal.ai portrait-gen sub-app) |
| `ui-files.js` | ✅ | campaign folder, `buildFilename`/`exportToFolder`, save/blueprint/narrative export + `importSave` |
| `ui-sheets.js` | ✅ | char/NPC sheet rendering (`csSheetSections` one-renderer-three-hosts), `showCharSheet`/`showNpcSheet`, `generateNpcSheet`, `_switchPlayerCharacter`, `showCapabilityCard` |
| `ui-browsers.js` | ✅ | character/blueprint/companion browsers, character import/export flows, `_renderCompanionSlots` |
| `ui-campaigns.js` | ✅ | campaign picker + CRUD, cloud push/pull, server connect/disconnect |
| `ui-carmode.js` | ✅ | the Car Mode overlay (#2); **#308 bookends:** `_carPreviously` speaks `carRecapText` on resume (>`PREVIOUSLY_AFTER_MS`) or on "previously"; "wrap up" arms `wrapUpPing` → `buildWrapUpNote`; the montage rides the fourth button (`montageDue` → `montagePing` → `buildMontageNote`) |
| `ui-modals.js` | ✅ | settings & utility modals (rules, sync, render options, provider, usage, prose, quest journal, bug report, #17 drift health) |
| `ui-boot.js` | ✅ | `buildFileMenus`, `wireButtons`, init/bootstrap — LOADS LAST; ends with the window load listener |
| `tts.js` | ✅ Active | Text-to-speech: `TTS` module with a `TTS_PROVIDERS` table (mirrors the LLM `PROVIDERS` shape): `server` / `piper` (local WASM, offline, $0. → [full contract](DOC/contracts/tts-stt.md#ttsjs) |
| `stt.js` | ✅ Active | Speech-to-text input: `STT` module with **two independent paths**. → [full contract](DOC/contracts/tts-stt.md#sttjs) |
| `sound.js` | ✅ Active (#7) | UI sound library — WebAudio-SYNTHESIZED earcons for game events; no audio files, no deps, no network. ONE lazy singleton AudioContext (monotonic-resources rule; note nodes disconnect `onended`). `Sound.play/preview/playIfQuiet` + enabled pref; TTS.earcon house style (debug for benign skips, warn for caller mistakes, never throws). Node-safe |
| `bible_study.html` | ✅ Active | Satellite viewer (TODO #10) for the `*_bible` registries — open directly (like `blueprint-designer.html`, NOT in the SW app shell). → [full contract](DOC/contracts/satellites.md#bible-studyhtml) |
| `class_bible.js` | ✅ Active (#72, engine-wired) | THE single definitive source for character progression. The engine reads it via classDef()/classDefs() + classFeaturesAt()/archFeaturesAt()/classXpLevels() (helpers.js). → [full contract](DOC/contracts/items.md#class-biblejs) |
| `item_bible.js` | ✅ Active (#81) | Curated canon for mechanics-bearing carried items — the spell-bible pattern for gear. → [full contract](DOC/contracts/items.md#item-biblejs) |
| `skills_bible.js` | ✅ Active (#52) | The canonical skills reference. `SKILL_LEVEL_MECHANICS` = ONE global ladder (index-aligned with `SKILL_LEVELS`): flat check bonus per level (+1 Familiar … +5 Master, stacks with the stat mod) + auto-success bands (Trained+ through Master rolling progressive… → [full contract](DOC/contracts/items.md#skills-biblejs) |
| `bible_editor.html` | ✅ Active (#72) | **Dev-only authoring satellite** for the `*_bible` files — separate from the read-only bible_study by design (bibles may go player-facing. → [full contract](DOC/contracts/satellites.md#bible-editorhtml) |
| `author_voice_lab.html` | ✅ Active (#104) | **De-branding test satellite** for the prose-voice feature (open directly. → [full contract](DOC/contracts/satellites.md#author-voice-labhtml) |
| `map_viewer.html` | ✅ Active (#154) | Satellite viewer for the campaign's **location graph** — the GM's actual working geography as an interactive force-layout SVG (hand-rolled, no deps): world nodes sized by visits, sublocations clustered on parents, first-travel edges, party position ring, sp… → [full contract](DOC/contracts/satellites.md#map-viewerhtml) |
| `map_cleanup.html` | ✅ Active (#156 Phase B) | **Dev-only guided location-repair satellite** (bible_editor precedent. → [full contract](DOC/contracts/satellites.md#map-cleanuphtml) |
| `character_editor.html` | ✅ Active (#62) | The STANDALONE character editor — every v10 field through ONE `FIELDS` + ONE `LISTS` registry (adding a field = one entry), class/archetype pickers from the class bible, portrait upload at the game's 400×600 JPEG contract, .char load/save in the game's own … → [full contract](DOC/contracts/satellites.md#character-editorhtml) |
| `home.html` | ✅ Active (#290) | The player's HOME PAGE — Play / Designer / Reference cards, the CURATED shelf (`samples/catalog.json`, originals only. → [full contract](DOC/contracts/satellites.md#homehtml) |
| `bug_tracker.html` | ✅ Active (#71) | Satellite viewer for the **bug-triage pipeline** over the #16 reports. → [full contract](DOC/contracts/satellites.md#bug-trackerhtml) |

### Script load order

```
globals.js → wasm-probe.js → error-report.js → compress.js → data.js → capability_bible.js → class_bible.js → skills_bible.js → item_bible.js → helpers.js → state.js → storage-adapter.js → memory.js → clock.js → identity.js → tag_table.js → api.js → table-talk.js → campaign_generator.js → char-creation.js → game.js → ui-shell.js → ui-panels.js → ui-portrait.js → ui-files.js → ui-sheets.js → ui-browsers.js → ui-campaigns.js → ui-carmode.js → ui-modals.js → ui-boot.js → tts.js → stt.js → sound.js
```

Each file depends only on symbols defined by files earlier in this list. The ENGINE subset of this order (minus the DOM-wiring files: wasm-probe, char-creation, ui-*, stt) lives as data in `dev/engine-manifest.js` — the single list both `dev/load-engine.js` (node) and `test.html` (browser, generated tags + load guard) derive from, mechanically checked against index.html by the ENGINE MANIFEST CONTRACT in run-tests.js (review 2026-08-01; the old manual test.html copy had silently dropped clock/table-talk/sound — the #17 rot class).

### Contracts (read on demand — #310)

The system contracts live one file per drift-surface system under `DOC/contracts/`. A session loads this map and pulls the contract it needs; every file opens with a *read this when* line. Anything in them is as binding as it was here.

- [`tags.md`](DOC/contracts/tags.md) — State tags — the parser, the strip, and the GM-facing doc. Read when you touch tag_table.js, applyMuts, cleanTxt, a tag's parse/strip/doc, or a refusal path.
- [`prompt.md`](DOC/contracts/prompt.md) — Prompt assembly, providers, caching, suggestions and Table Talk. Read when you touch buildSysPrompt, the stable/volatile split, callGM, a provider adapter, the suggestion call or Table Talk.
- [`memory.md`](DOC/contracts/memory.md) — Memory tiers, summarization, RAG, core memory, the map and drift health. Read when you touch summarize/extraction, memoryTOC/detail, RAG retrieval, chapters/eras, the map graph or the health readout.
- [`identity.md`](DOC/contracts/identity.md) — Identity — W2 referential integrity, W7 relationship axes, presence, aliases. Read when you touch NPC identity, death gating, scene evidence, relationship axes, aliases or merges.
- [`clock.md`](DOC/contracts/clock.md) — The campaign clock. Read when you touch clock.js, TIME/TIME_ADVANCE/TIME_CHECK handling, schedules or phase reconciliation.
- [`combat.md`](DOC/contracts/combat.md) — Combat. Read when you touch the combat tracker, foe routing, COMBAT_* tags or the death propagation at a close.
- [`quests.md`](DOC/contracts/quests.md) — Quests, XP, levels and alignment. Read when you touch the quest lifecycle, milestones, level-up, spell unlocks or alignment drift.
- [`items.md`](DOC/contracts/items.md) — The bibles — capabilities, classes, skills, items. Read when you touch a *_bible file, the bible editor, item canon, pricing or the wares economy.
- [`sync.md`](DOC/contracts/sync.md) — State, storage, cloud sync, checkpoints and the character library. Read when you touch state.js, save/load, the sync adapter, the CAS guard, checkpoints or the library endpoints.
- [`tts-stt.md`](DOC/contracts/tts-stt.md) — Voice — TTS, STT, sound and Car Mode. Read when you touch tts.js, stt.js, sound.js, the Piper/server/Gemini ladders or Car Mode.
- [`render.md`](DOC/contracts/render.md) — Rendering, portraits and the character sheet. Read when you touch doRender, the fal.ai models, portrait paths or the sheet modal.
- [`character.md`](DOC/contracts/character.md) — Character creation, game data and the v10 schema. Read when you touch the wizard, data.js constants, the character schema or a blueprint.
- [`satellites.md`](DOC/contracts/satellites.md) — Satellites, menus and the error reporter. Read when you touch a satellite page, the File menus, the bug report path or the SW allowlist.

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

## Conventions

- **ES5.1+ JavaScript** — `var`, no arrow functions, no template literals, no `const`/`let`. `async/await` only in the three API-facing functions. ES5.1 builtins (`.forEach`, `.map`, `.filter`, `Object.keys`) and `Object.assign` (ES6, universally supported) are permitted.
- **Single-character variables** common in dense utility functions.
- **HTML built by string concatenation** — no templating engine.
- **State versioning via key suffix** — all storage keys end in `_v10` (campaigns in `_v1`).
- **No front-end dependencies** — CSS and JS entirely self-contained.
- **CSS variables** for theming — palette in index.html's `:root`; **satellites link `satellite.css` (#312) and define no tokens of their own** — one palette across the game, the home page, the reference and the editors (the SATELLITE PALETTE CONTRACT in run-tests pins it). Accent `--acc` is the visual identity color.
- **Modals always created fresh** — remove prior instance by ID before creating new one.
- **`busy` flag** — global boolean gates all API calls. Always set `busy=false` in both success and error paths.
- **Scrollbars** — custom styled via `::-webkit-scrollbar` rules: 6px wide, near-black track, dark grey thumb, amber on hover.
- **No pill/chip borders on non-interactive elements** — use plain text, comma-separation, or `cs-list-row` rows instead. Borders imply clickability. ONE sanctioned exception: the verdict-badge standard below, for doc/satellite pages only.
- **Verdict/status badge standard (user-approved 2026-07-12)** — doc/satellite pages needing a colored verdict badge use the muted-fill pill (`.lean`, DOC/Research/app_vs_browser.html): background = the accent cut to 20% of its HSV value (`#7aa86a` → `#182215`), 1px full-brightness accent border (the rim carries the color), bold monospace uppercase text at `rgba(255,255,255,.4)`, `border-radius:12px; padding:2px 10px; font-size:.78em; letter-spacing:1px`. Game-UI surfaces keep the no-pill rule above.
- **`DOC/` holds reference docs; audits live in `audits/`; satellite TOOLS stay at root; so does the daily working set** (`CLAUDE.md`, `TODO.md`, `todo_checkWithFable.md` — by design; lint-todo hardcodes the path). Sample `.blueprint` fixtures in `samples/`; personal `.tnd` saves in `testRuns/` (gitignored); exported narrative mementos in `momentos/` (gitignored). A file cited by an audit must keep its link working — move the citation in the same commit.
- **Trackers — one job each (consolidated 2026-07-29):** open work lives ONLY in **`TODO.md`** (single source of truth; update the row in the same commit as the fix); **status glyphs: ○ not started · ◐ partially complete · ◉ ready to test · ✅ complete — a row with ANY unfinished work is never ✅ (owner rule 2026-09-02); closed rows move to `DOC/TODO_ARCHIVE.md`** (2026-09-01 — byte-identical, own commit, row numbers global across both files; the largest records live under `DOC/todos_completed/`). **`DOC/BUGS.md`** = field-report pipeline only. **`todo_checkWithFable.md`** = the Fable-review queue (full records archive to `audits/FABLE_REVIEW_RECORDS.md`); while the Fable budget is exhausted, ALL Opus work is documented there (user rule 2026-07-29). **Session handoffs are ephemeral** — open items merge into TODO.md; the file archives as `DOC/HANDOFF_v<ver>.md` when superseded. Completed reviews/audits live under `audits/`.
- **No surface is allowed to be untestable, and no guard is trusted until sabotage proves it** (2026-07-29; origin story in [history](DOC/CLAUDE_HISTORY.md#the-2026-07-29-bible-editor-spiral-origin-of-the-guardrail-rules)). The rules and tools:
  1. **If a surface can't be driven by `dev/run-tests.js`, the first commit that touches it adds a seam.** "I can't click the button" is almost never true — buttons call functions, and functions can be called (the bible editor's seam is `window.__bibleTest` + an OPFS `FileSystemFileHandle`: real handle, no picker, no gesture). Satellites with logic each need one — bible_editor, author_voice_lab, map_viewer, map_cleanup, blueprint-designer, and bug_tracker have theirs.
  2. **Prove every contract clause with `dev/sabotage.js`, and treat a mutation that changes no bytes as a FAILURE.** A green clause guarding nothing is worse than no clause. The harness restores the file on exit, crash and Ctrl-C, and asserts byte-identical restoration.
  3. **`dev/file-forensics.js <file>` before the second theory.** One command prints every file-level fact (size, times, encoding, parses-or-not, git state, temp siblings, write-lock) and exits non-zero on anomalies. When an error asserts a fact, verify it exhaustively before reinterpreting it.
  4. **The bible workflow is SERVER-FIRST (#72 overhaul, 2026-08-14 — the fill-phase-languish diagnosis):** run `node dev/bible-server.js`, then every editor save (class Save, capability Add/Update) is one-click — validated by install-bible, written by node, no FSA ceremony, and NO TOKEN for locally-served pages (origin allow-list; the per-run token survives only for file:// pages). The editor's header pill shows which save-world you're in before you type; the download fallback is HONEST (no in-page illusion — contract-pinned both directions). `dev/install-bible.js` (validates class/capability/item by content, **refuses an empty file**) remains the manual path for downloaded copies.
- **Dev-vs-Beta menu tier (#289, v1.764):** operator rows carry `cls:"fm-dev-only"` in the spec (Language Model, Usage & cost, campaign folder, Connect/Disconnect, the Admin Clear-cache, the Legacy block); `applyMenuTier` (ui-shell.js) hides them for a signed-in non-admin via one `!important` rule, deciding through the pure `menuTierHidesDev` (helpers.js) on `serverAccount.isAdmin` (server-derived from ADMIN_USER_IDS). UX only — real gates stay server-side. Pinned by the MENU TIER CONTRACT. **File menus are GENERATED, not hand-written** — `buildFileMenus()` (ui-boot.js) renders all three File menus from ONE spec; add/move/remove items by editing the spec, never index.html (the mount divs are empty). Ids keep the `fm-`/`cs-fm-`/`api-fm-` prefixes; per-surface differences (disabled items, mobile-only actions) are flags in the spec.

---

## Known issues

- **Local folder rename pending** — `dnd_rpg` → `traffic-and-dragons` (do in Explorer before opening Claude Code; then update hardcoded paths in `.claude/settings.local.json` and `.claude/hooks/stop-check.js`)

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
- **Service worker (`sw.js`)**: **cache-first with network fallback.** Safe ONLY because the `CACHE` constant is bumped on every deploy (hard rule) and browsers fetch the SW script fresh per navigation, so a bump is always detected. Net: ≈zero asset bandwidth between deploys, ~1-navigation lag before a new version shows. (Network-first was tried and reverted — bandwidth cap; [history](DOC/CLAUDE_HISTORY.md#swjs-caching--the-full-arc).) Stuck browser → File → Clear cache & reload. On `localhost` the SW also intercepts — unregister via DevTools if files look stale.
- Always test on **Cloudflare Pages** after `git push` — `file://` and the deployed site can have different cached files. (Hosting: Cloudflare Pages — pure static, no build command, output dir = repo root; `_headers` controls cache; unlimited bandwidth.)
- Use the **Sync** button in-game to manually patch world state.
- Use **Table Talk** tab to query the GM out-of-character while debugging.
- Wipe state: DevTools → Application → Local Storage → delete all `tnd_*` keys, or use **New Game**.
- **Export save** before testing risky changes.
- **CI test gate:** `.github/workflows/engine-tests.yml` runs `node dev/run-tests.js` (the full assertion suite + every source contract) on every push and PR — the local pre-commit hook is no longer the only enforcement (review 2026-08-01).
- **Automated playtest harness** (`dev/playtest-harness.js`, not loaded by `index.html`) — drives N real GM turns against a throwaway character via `preview_eval`: smoke-tests invariants and collects a narration corpus for prose-voice/content-DNA drift judging. Ops: the `/playtest` skill.

**Diagnosis & verification discipline** (origin sagas in [history](DOC/CLAUDE_HISTORY.md#the-v027v028-textarea-saga-origin-of-the-diagnosis-discipline)):
- **Verify the FAILURE condition, not a benign case.** A check that can't fail proves nothing — exercise the input that would break it: overflow, empty, boundary, the exact thing reported.
- **For visual/layout work the screenshot is ground truth; measurements are a proxy.** When they disagree, believe the render and find why the number lied. Don't let a passing metric override the eye.
- **"Measures fixed but reported still broken" → reproduce before explaining.** The gap is the clue; "cache/environment" is never the first explanation for a divergence you haven't reproduced. A user's "confirm it visually" is usually correct — honor it.
- **Test-first on engine changes** — the failing assertion defines and exercises the break before shipping. Headless tests can't see CSS layout, so a visual bug's test-first equivalent is a scripted preview that sets up the edge case AND screenshots it.

**Drift-protection change policy (user decree 2026-07-09):** the anti-drift stack is the product's core, validated value; its failure modes are SILENT (degraded canon, dead cache, fused NPCs). **The drift surface:** `applyMuts` write paths · all memory tiers (summarize / RAG / memoryTOC / futureEvents / alias-resolution / NPC merge) · `buildSysPrompt` canon-injection blocks, the stable/volatile cache split, and STYLE-at-end position · `cleanTxt` + the tag vocabulary + the STATE TAGS prompt docs · transcript integrity (`serializeWorldState`/`parseWorldState`) · quest/skeleton lifecycle teeth. **Any task touching this surface, however small: Tier = Fable (never hand it to a lighter session, even if it looks mechanical), a critical review of the task BEFORE any code — consider what it touches, what silent failure it could cause, and the test plan, examined from alternate angles; present to the user ONLY if a confident solution can't be resolved (amended 2026-07-12 — a confidently-resolved review is recorded in the commit/tracker row instead, and genuine design forks still go to the user) — and thorough verification AFTER (engine tests + stable-half byte-identity + prompt/mutation diff against real transcripts + live spot-check where warranted).** See Fable_UberAudit.md ▸ "Standing policy" for the per-task guard notes.

**The safe-changes map (#21, owner-ratified 2026-08-14) — what may ship OFF-Fable.** The drift decree above guards the surface, not everything near it; these change shapes are LEGAL for lighter sessions, each logged as ONE line in todo_checkWithFable.md ▸ "Off-Fable log" (batch-skimmed later; the log graduates away if skims stay clean):
- **Registry/table ENTRIES** where a coverage guard already polices the shape — bible entries (capability/item/skills + class fill-phase content), `PROVIDERS` model-list refreshes, TTS voice bank, `AUTHORS` entries. Entry additions only; schema or accessor changes stay Fable.
- **Satellite pages** that stay read-only and touch no engine file (bible_study, map_viewer, bug_tracker views) — plus the mandatory sw.js network-first allowlist line for any NEW satellite.
- **dev/ tooling and tests** — ADDING tests, harnesses, and forensics is always legal; loosening, deleting, or re-baselining an existing assertion or frozen hash is a contract change → Fable.
- **Docs** (TODO rows, DOC/, audits) — except CLAUDE.md's contract sections for drift-surface systems.
- **Thin DOM shells** over engine-tested pure functions (the one-renderer rule): panel/modal layout, CSS, toast presentation — never the pure function itself, never anything a prompt or parser reads.
- **Version/CACHE bumps** and deploy mechanics.

Everything else — and anything AMBIGUOUS — defaults to Fable per the decree. The drift-surface list above defines the boundary; this map is a whitelist, never its complement.

**Standing audit dimension (2026-07-17, the r8/jetsam lesson):** every audit includes a **monotonic-resources pass** — enumerate everything that accumulates (JS-side AND inside vendored wasm deps) at per-call / per-turn / per-session / per-campaign / per-device-forever scope (five scopes — the 2026-07-17 monores pass proved the list extends above session); a prior fix's retained singleton is not exempt; second instance of a failure class → enumerate the class, don't ship a third point-fix; memory-class verification = duration (piper_test.html soak mode), not a single input. Full text: Fable_UberAudit.md ▸ "Standing audit dimension — monotonic resources".

**Version number:**
- Current: see `APP_VERSION` in `globals.js` — never hardcode the number in docs (it rots).
- Constant `APP_VERSION` in `globals.js` — consumed by `updateMemStatus()` (session bar) and injected into all three File ▾ menu version labels via `_menus` loop in `wireButtons()`.
- **Bump `APP_VERSION` on every commit that changes game code** — no exceptions. Also bump `CACHE` in `sw.js` on the same commit. This is how you confirm the right version is deployed.
- **ONE carve-out: the Blueprint Designer versions separately** (user call 2026-07-05). `BP_DESIGNER_VERSION` in blueprint-designer.html — bump IT on designer-only commits, and do NOT bump `APP_VERSION`/`CACHE` for them (the designer isn't in the SW app shell). A commit touching BOTH designer and engine files bumps both. The designer header shows `v0.x · engine v1.y` because blueprint schema compatibility tracks the engine.
