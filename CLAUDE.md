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
| `index.html` | **Active host** | CSS, HTML scaffolding, 32 `<script src>` tags, no inline JS |
| `globals.js` | ✅ Extracted | `apiKey`, `busy`, `lastAction`, `panelCol`, `secCol`, `activeChatTab`, `pendingChar`, `pendingSpellPool`, `pendingBumps`, `currentBump`, `rvGold`, `customRules`, `RENDER_MODELS`, `pendingCompanions` |
| `wasm-probe.js` | ✅ Active (B9) | WebAssembly linear-memory probe — hooks the wasm instantiation entry points at load (must run before any wasm exists), making ORT's otherwise-invisible linear-memory growth measurable. Loaded by BOTH index.html and the Piper synthesis iframe |
| `error-report.js` | ✅ Active (#16) | Mobile error reporting — `reportError(ctx,msg,detail)` POSTs runtime errors to a Google Apps Script webhook that emails pmegow@gmail.com (the mobile console is invisible; this is the channel). `ERROR_WEBHOOK_URL` at top (empty = disabled). Flood control: 30s debounce + 10/session cap + reentrancy latch. Wires `window.onerror`/`onunhandledrejection` at load (browser only); called from the turn/re-roll/skeleton/actions/summarize catches and the Piper narration-death crumb. Transport seam `_erSend`/`_erPost` is test-stubbed. **#16c diagnostics:** per-page-load `ER_SESSION_ID`, `erCrumb(evt,data)` — a bounded localStorage breadcrumb ring recovered at next boot so a PROCESS KILL's final seconds survive — and `erDiagBlock()` appended to every crash `detail`. All of it rides in `detail` ON PURPOSE — the GAS sheet is a fixed 15-column user-deployed schema; a new column means a redeploy + migration. **#16b user reports:** `sendUserReport`+`erReportContext`+`ER_REPORT_HINTS` (message-keyword → extra state; never keys/tokens) here; the modal + DOM-screenshot capture (`showBugReportModal`/`_bugCapture`, vendored `/vendor/html-to-image/` — `toSvg` only; the lib's `toJpeg` hangs in embedded Chromium; `_bugShotFilter` + `imagePlaceholder` keep one bad img from rejecting the whole capture) in ui-modals.js; File ▸ ⚠ Report bug (game screen only) |
| `compress.js` | ✅ Active | Self-contained LZ-string UTF-16 compressor (`LZ.compressToUTF16`/`decompressFromUTF16`, public-domain LZString, no deps) — compresses ONLY the transcript at the localStorage boundary (see §3 transcript compression); loads right after error-report.js in the SW app shell and the headless test runner |
| `data.js` | ✅ Extracted | Game data constants (TONES, ANCS, SPELLS, ARCH_SPELLS, STAT_BUMP_LEVELS, DEITY_MAP, DEITY_CENTRIC, DEFAULT_RULES, SPELL_PICK_LIMITS, SKILLS, SKILL_LEVELS, SKILL_THRESHOLDS). **C6-③ (2026-08-03): the class tables (CLSS/ABILS/ARCHETYPES/CLASS_FEATURES/XP_LEVELS/STAT_PRIORITY) are DELETED — class_bible.js is the store, read via classDef()/classDefs()/classFeaturesAt()/archFeaturesAt()/classXpLevels() (helpers.js)** |
| `capability_bible.js` | ✅ Active | The unified `capability_bible` (#10) — `CAPABILITY_BIBLE` holds spells AND abilities (`kind` is cosmetic, `cost`+`isMagical` are the real axes). Keyed by base name (`capBaseName()`); schema `{kind:"spell"|"ability", tier, cost, isMagical, category, range, targets, duration, effect, dice?, save?}`. **`category`** is a LIST of traditions (`arcane`/`divine`/`primal`/`necromantic`/`martial`) — the gate for a rolled enemy caster's menu; `capabilitiesByCategory(cat)` returns the matching list. **Fixed attribute set:** every entry carries all of cost/range/targets/duration/save/dice, `"N/A"` where inapplicable — the card always shows the same 6 rows and injected canon can never be queried empty. `capBibleLine()` (api.js) renders one labeled injection line. **`capabilityLookup()`** — the ONE lookup for card, viewer, and injection: emergent `worldState.capabilityBible` overlay (write-once via `[SPELL_DEF:]`) wins over the static base; an ability that is really a spell resolves to its spell canon — no dup. Anti-drift injection: `buildSpellBibleBlock()` + `buildAbilityBibleBlock()` (api.js) re-inject canon for the player's known spells/abilities every turn (volatile half). Genuinely-different domains get their own `*_bible` files |
| `helpers.js` | ✅ Extracted | Utility functions: `smod`, `skillLevel`, `initSkills`, `alignLabel`, etc. Plus `bibleCardHTML(name,entry)` (TODO #10) — the shared pure capability-card renderer used by BOTH the in-game click-card and `bible_study.html` (one render, two hosts) |
| `state.js` | ✅ Extracted | `store`, `worldState`, `sessionLog`, `memory`, save/load functions, storage key constants |
| `storage-adapter.js` | ✅ Extracted | Cloud sync: `loginWithServer`, `syncToServer`, `syncCampaignList`, `loadFromServer`, `logoutFromServer`, `listCharacterLibrary`, `saveCharacterToLibrary`, `deleteCharacterFromLibrary`; `authHeader()` (#90 — the assembled Authorization header for the tnd-tts app, never the raw token) |
| `memory.js` | ✅ Extracted | `sessionTokens`, `fileNpcEvent`, `fileLocation`, `fileLore`, `fileDecision`, `fileFutureEvent`, `resolveFutureEvent`, `memoryTOC`, `memoryNpcDetail`, `summarize` |
| `clock.js` | ✅ Active (#73) | The CAMPAIGN CLOCK — ONE monotonic scalar `worldState.clock.min`; the day/hour/minute view is DERIVED, never stored. The GM does ZERO arithmetic: it emits duration estimates (`[TIME_ADVANCE:2h]`), the engine does every add and RECOMPUTES every countdown from the anchor (a number the GM never re-states cannot drift). Schedule store (`scheduleAdd`/`scheduleDue`) + `buildClockBlock()` prompt injection; per-response advance cap `CLOCK_MAX_RESPONSE_ADVANCE`. Full spec: DOC/Research/DOC_clock.html. **#158 (v1.584): the phase-mismatch detector** — `clockPhaseAssertion` recognizes a high-confidence current-phase assertion in committed CLEAN prose (the full accept/reject-context grammar lives in clock.js), `clockPhaseBandDist` compares against the post-applyMuts clock by BAND distance (a `[TIME:morning]` tag under dusk narration is a CONTRADICTION and still alerts), ≥`PHASE_MISMATCH_MIN`(240m) arms `worldState.phaseMismatch` → `buildPhaseMismatchNudge` (one-shot GM-decides; NEVER auto-advances). Seams: `commitGmTurn` post-applyMuts + `rerollLast` (rerolls apply NO tags — nudge-only), both contract-pinned; enable gate = the 328-turn t1593 precision audit (`dev/clock-phase-audit.js`); sabotage `dev/sabotage-phase.js` 10/10. **#142 (v1.563): reconcile is skip-and-demand across DAWN** — a `[TIME:]` top-up whose declared phase already passed this engine-day AND >`RECONCILE_SKIP_MIN`(6h) is presumed a mislabel: text kept, roll skipped, `buildReconcileSkipNudge` demands [REST:long]/[TIME_ADVANCE:Nd]/a corrected [TIME:]. Honest same-day skips reconcile as before |
| `identity.js` | ✅ Active (#156) | ⛨ **THE IDENTITY LAYER spine** — `IDENTITY_DOMAINS` registry (npc = full adapter; capability/item = type domains with `merge:null`; location = Phase B; quest/faction evidence-gated Phase C), `resolveEntity(domain,name)`, `_identityActionTag` (the `[ALIAS:]`/`[MERGE:]` parse core — pipe/unknown-domain/uncapable refusals LOUD and mutation-free; npc operands route into the NPC_ALIAS/NPC_MERGE handlers so the vocabularies cannot diverge), **`npcUpsertTarget`** (THE collision boundary in the `[NPC:]` handler: an introduction-shaped write into a history-rich living non-party record lands in a **PROVISIONAL identity** `"Name °tN"` — never blocks, never fuses; cap `PROVISIONAL_CAP`=4, beyond it LOUD degrade to a direct write; honest limit: the t988 false-familiarity class is not engine-detectable), `buildProvisionalNudge` (the same/distinct fork — `[NPC_MERGE:canon\|prov]` folds back, `[MERGE:npc\|Proper Name\|prov]` renames; re-fires every `PROVISIONAL_NUDGE_COOLDOWN`=5 turns, combat-silent), `buildNamingClause` (stable-half identity discipline). Every npc merge archives the duplicate's complete pre-image to `memory.archive.identityMerges`; provisional ° keys never become permanent aliases. **Phase B (v1.582) — the location domain**: node keys are **IMMUTABLE NAME-BORN identifiers** + a SPARSE identity overlay `memory.map.identity.entries` ({mergedInto, aliases, display}); reads resolve via `locResolve` (memoized, cycle-guarded loud) / `locSame` / `locIsSub` (world-ness = parent relation, NEVER key shape) / `locDisplayLeaf`. **Executors**: `locMerge` (record fold + tombstone + alias + `_locHealLivePointers` — live pointers rewritten at repair time; the O(n) historical mass stays as written and RESOLVES at read), `locReparent` (ancestor-cycle guard), `locSplit` (tool-only — allocation is human), `locAliasRegister` (live-key refusal). Every location write/read seam resolves through them (fileLocation* family, mapNpcLocation, RAG scoring, geo block, scene manifest, affordance travel gate, #133b rejoin, blueprint export). Repair surface: `dev/loc-repair-core.js` (census — typed evidence, **classifies nothing**; true dry-run) + the **map_cleanup.html** satellite. Sabotage: `dev/sabotage-identity.js` (22 cases). Plan: [DOC/Research/identity_hardening_fable.html](DOC/Research/identity_hardening_fable.html) §7; rulings/records: [A0](audits/AUDIT_identity_A0_representation_gate.md), [Phase A](audits/AUDIT_identity_phaseA_v1.581.md), [Phase B](audits/AUDIT_identity_phaseB_v1.582.md) |
| `tag_table.js` | ✅ Active (UA1) | ⛨ **THE tag registry** — one ordered table (`TAG_TABLE`, ~57 handlers) from which three formerly hand-synced surfaces DERIVE: `applyMutsTable()` (THE parser), `buildCtTags()`/`buildCtBare()` (cleanTxt's strip regexes), and `buildStateTagsDoc()` (the STATE TAGS prompt block, frozen by engine tests). **SOLE PARSER** — the legacy parser is DELETED after a zero-diff validation arc ([history](DOC/CLAUDE_HISTORY.md#tag_tablejs--the-ua1-validation-arc)); rollback is `git revert`, not a flag. Retained tripwires: `__tagUnknownScan` (unknown tags warn), `__tagNoCombatWarns` (UA27), coverage guards + frozen strip/doc hashes in the suite. Adding a tag = one table entry (parse+strip+docs land together, phantom class impossible). `TAG_NO_HANDLER` documents the deliberate parse-less names. Smoke-replay tool: `dev/diff-replay.js <corpus.json>` |
| `api.js` | ✅ Extracted | `callGM`, `buildSysPrompt`, `getRulesBlock`, `applyMuts` (a thin veneer — `applyMutsTable()` + `__tagUnknownScan()`; the legacy parser is deleted), `findCompanionChar`, `cleanTxt` (regexes derived from tag_table), `diceTxt`, `parseActions`, `buildGeoBlock` |
| `table-talk.js` | ✅ Active (#76) | The Table Talk HELP AGENT — an out-of-character help desk answering factual questions about the app, the rules, and this campaign's own history; NEVER advances the story. Deliberately does NOT call `buildSysPrompt` or reuse its stable half (a second, differently-shaped prefix in front of the cached block would silently kill gameplay prompt-cache hits — the UA5 cost-regression class). Structural isolation (TT can never reach `commitGmTurn`/`applyMuts`/transcript/sessionLog) is pinned by the #76 TABLE TALK ISOLATION CONTRACT in run-tests.js |
| `campaign_generator.js` | ✅ Active (#59) | ⛨ Shared campaign-skeleton generator + one-pass review serving TWO consumers: `game.js generateSkeleton()` (freeform campaign start gets ONE review pass + auto-correction; failure falls back LOUDLY to the valid first draft — never blocks start) and the designer's "✨ Generate…" draft blueprint. Contents: verbatim-extracted skeleton prompt fragments (the assembled game prompt is byte-identical to pre-extraction), `validateSkeletonStructure`/`stampSkeletonStatus` (pure, engine-tested), `reviewCampaignSkeleton` (ONE fix per finding, cap 8), `correctCampaignSkeleton`, `generateBlueprintDraft`. No DOM, no state writes, no toasts — callers own failure surfacing. `worldState.skeleton` shape and `buildSkeletonBlock` untouched |
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
| `ui-carmode.js` | ✅ | the Car Mode overlay (#2) |
| `ui-modals.js` | ✅ | settings & utility modals (rules, sync, render options, provider, usage, prose, quest journal, bug report, #17 drift health) |
| `ui-boot.js` | ✅ | `buildFileMenus`, `wireButtons`, init/bootstrap — LOADS LAST; ends with the window load listener |
| `tts.js` | ✅ Active | Text-to-speech: `TTS` module with a `TTS_PROVIDERS` table (mirrors the LLM `PROVIDERS` shape): `server` / `piper` (local WASM, offline, $0 — #41; vendored at `/vendor/piper/`, voices cached in OPFS) / `native` (browser speechSynthesis). Engine selection is RESOLVED, never stored — there is no picker ([history](DOC/CLAUDE_HISTORY.md#ttsjs--provider-evolution)). **Server tier (#90 M1):** `TTS_LADDER = server → piper → native` — a connected player's narration synthesizes on the self-hosted **`tnd-tts` Fly app** (§22); `getEngine()` resolves `"server"` when connected+healthy, else `"piper"`. Any server unit failure hands the read's remainder down the ladder via the queue + a 60s retry memo (degrade toasted once per session). Self-hosting is why the #84/LiveKit objection doesn't apply ([DOC/Research/liveKit_findings.html](DOC/Research/liveKit_findings.html)). The per-item **downgrade-to-native** ladder survives below all of it (`_piperOk` can drop ONE item without changing the engine); the work-budget governor meters ONLY the local Piper tier and remains the offline tier's guardian forever. Shared text-prep (`normalizeForTTS`/`splitSentences`), queue/scheduler, voice bank. **NPC casting (#174):** every roster NPC auto-casts from the starred bench on first speech (sheet gender → pronouns → full bench); the stable pick persists on the NPC record until a generated sheet inherits it. |
| `stt.js` | ✅ Active | Speech-to-text input: `STT` module with **two independent paths**. ① **Native** — Web Speech API (`webkitSpeechRecognition`, zero-dependency): Chrome/Edge desktop + Android Chrome; NOT Firefox; iOS Safari has NO SpeechRecognition at all. ② **Cloud fallback** — when native is absent AND an OpenAI key is on file, `MediaRecorder` captures the utterance and OpenAI transcribes it (#113 §4: `gpt-4o-mini-transcribe` primary, loud `whisper-1` fallback; `sttBiasPrompt()` roster/place/quest vocabulary on every request; WebAudio silence endpointing 1.5s/45s). **This is what makes the iPhone Safari / Car Mode path work** ([history](DOC/CLAUDE_HISTORY.md#sttjs--the-stale-doc-lesson-84)). A fully separate code section below the native one, so native behavior stays byte-identical wherever native exists; `isSupported()` gates the mic button on EITHER path. Both paths run the final transcript through **`sttCorrectNames`** (helpers.js) — roster-phonetic correction for fantasy proper nouns. Prefs: language/auto-send (`tnd_stt_lang_v1`/`tnd_stt_autosend_v1`), Car Mode auto-listen (`tnd_car_autolisten_v1`, default ON). Notifies Car Mode via global `carNotify(kind,text)`, always behind a `typeof` guard. ⚠ **Transcription cost rides the PLAYER's own key** — decisive in declining LiveKit. **#77 confirm gate (v1.548):** per-utterance confidence (`sttLogEvent` ring, read via `sttLogAll()`) feeds `sttSuspicion` (helpers.js), gating the AUTO-SEND path only — Car Mode speaks "I heard: … — send it?" with spoken yes/no/redo (`parseConfirmCommand`; the confirm interceptor sits ABOVE carVoiceCommand/busy-park/<3-char gates), non-car auto-send holds + amber-flags the field; File ▸ Admin ▸ 🛡 toggle, default ON; nothing touches sessionLog/transcript until confirmed. Invented tags (the [MANA:-1] leak) are display-stripped by cleanTxt's unknown-tag catch-all |
| `sound.js` | ✅ Active (#7) | UI sound library — WebAudio-SYNTHESIZED earcons for game events; no audio files, no deps, no network. ONE lazy singleton AudioContext (monotonic-resources rule; note nodes disconnect `onended`). `Sound.play/preview/playIfQuiet` + enabled pref; TTS.earcon house style (debug for benign skips, warn for caller mistakes, never throws). Node-safe |
| `bible_study.html` | ✅ Active | Satellite viewer (TODO #10) for the `*_bible` registries — open directly (like `blueprint-designer.html`, NOT in the SW app shell). Loads the bible data + helpers, renders every spell/ability via the shared `bibleCardHTML` and every skill via `skillCardHTML` (#52 — Skills section with the level-ladder header); live name/text filter. **Deliberately READ-ONLY** (user call 2026-07-27): the bibles may become player-facing, so the mutable surface lives in `bible_editor.html`, never here |
| `class_bible.js` | ✅ Active (#72, engine-wired) | THE single definitive source for character progression. The engine reads it via classDef()/classDefs() + classFeaturesAt()/archFeaturesAt()/classXpLevels() (helpers.js); level-ups grant NAMED class rows (2/5/7/9/11/13/15/17) and the committed archetype's rows (3/6/10/14/18+20), player and companion alike; `CLASS_XP_LEVELS` runs 1–20 (L11 gate 85000). 9 classes, 27 archetypes, 234 level slots, C2 spellTiers, C5 skillSeeds ([history](DOC/CLAUDE_HISTORY.md#class_biblejs--bible_editorhtml--the-72-build-out)). Machine-REGENERATED by bible_editor.html's exporter — canonical form `JSON.stringify(x,null,2)` between the `>>> CLASS BIBLE DATA` markers, byte-pinned by the BIBLE EDITOR CONTRACT (run-tests.js); content hand-edits in canonical form are legal, format drift fails the build. Coverage guard: every spell NAME in it must resolve via `capabilityLookup` (a new spell and its capability entry land in the SAME commit). In the SW app shell |
| `item_bible.js` | ✅ Active (#81) | Curated canon for mechanics-bearing carried items — the spell-bible pattern for gear. `ITEM_BIBLE` keyed by `itemBaseName()` (helpers.js); fixed-attribute schema `{category: weapon/armor/consumable/tool/quest/treasure/mundane, effect, uses, value}` ("N/A" where inapplicable). **TYPE vs INSTANCE is a build contract**: definitions describe the TYPE; instance state (charges, provenance, counts) stays on the inventory string — an entry carrying extra fields fails the BIBLE EDITOR CONTRACT. Reads via `itemLookup()`: emergent overlay `worldState.itemBible` wins over the base. **Emergent items are PLAYER-CONFIRMED**: `[ITEM_DEF:]` is a PROPOSAL queued on `worldState.pendingItemDefs` (cap 5, dedupe) — the confirm modal (ui-modals.js; resurfaces on boot) is the only path to canon via `itemDefAccept`/`itemDefDecline` (accept = write-once). Injection: `buildItemBibleBlock()` (api.js, volatile) — one line per carried resolvable item across player + party sheets; mundane/treasure/effect-N/A never inject. Tooltip: `itemTip()` (ui-panels.js). Machine-REGENERATED by bible_editor.html (byte-pinned `>>> ITEM BIBLE DATA` markers); read-only section in bible_study.html. **#157 (v1.583): two DISPLAY fields** — `inventoryCategories` (the FIRST match in `INVENTORY_CATEGORY_REGISTRY` (helpers.js) decides which inventory section an item files under) and `aliases` (exact alternate TYPE names, normalized, collision-refused; resolution is CANONICAL inside `itemLookup` — never substring/fuzzy). `effect:"N/A"` outside mundane/treasure = a legal classification-only entry (organizes + tooltips, never injects). Both inventory surfaces render through ONE pure `groupInventory()` view model (helpers.js — unknown/invalid items stay VISIBLE under Unclassified, never guessed). Coverage audit: `dev/item-bible-coverage.js`. Spec: [DOC/Research/DOC_inventory_reorganization.html](DOC/Research/DOC_inventory_reorganization.html) |
| `skills_bible.js` | ✅ Active (#52) | The canonical skills reference. `SKILL_LEVEL_MECHANICS` = ONE global ladder (index-aligned with `SKILL_LEVELS`): flat check bonus per level (+1 Familiar … +5 Master, stacks with the stat mod) + auto-success bands (Trained+ through Master rolling progressively less) — data-only by design, a rebalance is a 6-line edit. `SKILLS_BIBLE` = per-skill canon keyed by EXACT `SKILLS` id: `def` (coverage + boundary vs confusable neighbors) + `untrained` (`yes`/`hard`/`no`; specialist lists derived by `skillsUntrained()`). Injection (api.js): `buildSkillMechanicsDoc()` — the constant ladder doc in the STABLE half (byte-identical, cache-safe) — and `buildSkillCanonBlock()` — VOLATILE, EARNED skills only, ""-clean at zero. Viewer: `skillCardHTML` (helpers.js) + a Skills section in bible_study.html. Engine-tested: bidirectional coverage guard (new skill + bible entry land in the SAME commit, sabotage-proven), ladder shape, stable/volatile injection |
| `bible_editor.html` | ✅ Active (#72) | **Dev-only authoring satellite** for the `*_bible` files — separate from the read-only bible_study by design (bibles may go player-facing; players must never find a mutable surface). Opens a bible from disk and **SAVES BACK OVER IT** via the File System Access API; a lapsed handle re-grants through a **Reconnect** button inside a click gesture (the #30 permission lesson); no FSA → file-input import + download fallback, loudly. **Bible types are a REGISTRY** (`BIBLE_TYPES`: detect/parse/serialize/render) — adding a bible is ONE entry. Three types ship: **class_bible** and **item_bible** (machine-regenerated wholesale) and **capability_bible** (HAND-COMMENTED — untouched entries re-emit as their original source lines so a save is a minimal diff; contract-pinned BOTH ways, unedited round-trip AND all-dirty emit). Draft persists to `tnd_bible_editor_draft_v1` (old drafts MIGRATED, never discarded). Test seam: `window.__bibleTest` |
| `author_voice_lab.html` | ✅ Active (#104) | **De-branding test satellite** for the prose-voice feature (open directly; network-first in sw.js). Tests whether 12 shared attribute dials (analysis in [DOC/Research/DOC_author_voice.md](DOC/Research/DOC_author_voice.md)) re-create each author's voice with NO author name in the prompt. One row per `AUTHORS` entry (+ a Custom learning row): reference passage, dial sliders at rated baselines, dial-only / +devices / distilled-name-free / author-name-control arms (`VOICE_DISTILLED` exists because a name acts as a pointer into the model's corpus while a dial list is a description it averages). Loads globals.js + data.js read-only; slider tweaks persist in `tnd_voicelab_v1`; `?stub=1` fakes the model call. Seam: `window.__voiceLabTest`; VOICE LAB CONTRACT (run-tests.js) pins lockstep-with-AUTHORS, name-free prompts, and the sw.js allowlist entry — sabotage-proven |
| `map_viewer.html` | ✅ Active (#154) | Satellite viewer for the campaign's **location graph** — the GM's actual working geography as an interactive force-layout SVG (hand-rolled, no deps): world nodes sized by visits, sublocations clustered on parents, first-travel edges, party position ring, split badges, **ghost nodes** (edge-referenced but never filed — real rot). Click a node → its full record. READ-ONLY by construction (zero localStorage writes). Data sources in precedence order: `window.__mapTest` seam (headless-drivable) → imported `.tnd`/state JSON → same-origin localStorage (the LIVE view). ⬇ Export SVG. Open directly like bible_study; network-first in sw.js |
| `map_cleanup.html` | ✅ Active (#156 Phase B) | **Dev-only guided location-repair satellite** (bible_editor precedent — the mutable surface lives here, map_viewer stays read-only forever). Loads a `.tnd` file OR the LIVE active campaign, runs `locRepairCensus` (typed evidence; every group starts **undecided** — classification is human, per pair, never a batch), classify controls (merge/reparent/alias/leave; split and pipe-bearing plans ride the advanced plan-JSON box — allocation is inherently human), **dry-run diff** before a double-confirmed APPLY through the shipping executors (pre-images archived, reversible by construction). `.tnd` mode downloads `*_REPAIRED.tnd`; live mode writes back via `saveAll()`. Test seam `window.__cleanupTest`. Network-first in sw.js |
| `bug_tracker.html` | ✅ Active (#71) | Satellite viewer for the **bug-triage pipeline** over the #16 reports. GAS v2 (`dev/gas-error-webhook.gs`, user-deployed) dual-writes every report: email + Google Sheet + secret-gated `doGet` JSON feed. Tracker = `DOC/BUGS.md` (format contract in its header; report bodies fenced as UNTRUSTED data); ops = the `/bugs` skill: `sync` / `investigate` (dispatches the Read/Grep/Glob-only bug-investigator agent — mechanical injection containment) / `act` (gated on findings; drift-surface flag → Fable policy). Viewer buttons COPY the /bugs command to clipboard; the live server section reads the doGet feed directly (secret via 🔑 → localStorage). ⚠ ALL report-derived text renders via `textContent` — never innerHTML; **new satellites must be added to sw.js's network-first allowlist or the SW pins them stale**. Feed secret lives in gitignored `.claude/bugs.local.json` |

### Script load order

```
globals.js → wasm-probe.js → error-report.js → compress.js → data.js → capability_bible.js → class_bible.js → skills_bible.js → item_bible.js → helpers.js → state.js → storage-adapter.js → memory.js → clock.js → identity.js → tag_table.js → api.js → table-talk.js → campaign_generator.js → char-creation.js → game.js → ui-shell.js → ui-panels.js → ui-portrait.js → ui-files.js → ui-sheets.js → ui-browsers.js → ui-campaigns.js → ui-carmode.js → ui-modals.js → ui-boot.js → tts.js → stt.js → sound.js
```

Each file depends only on symbols defined by files earlier in this list. The ENGINE subset of this order (minus the DOM-wiring files: wasm-probe, char-creation, ui-*, stt) lives as data in `dev/engine-manifest.js` — the single list both `dev/load-engine.js` (node) and `test.html` (browser, generated tags + load guard) derive from, mechanically checked against index.html by the ENGINE MANIFEST CONTRACT in run-tests.js (review 2026-08-01; the old manual test.html copy had silently dropped clock/table-talk/sound — the #17 rot class).

### #168 W2 referential integrity (v1.601)

High-impact identity consequences use a persisted scene-referent ledger in `worldState.sceneRefs`. `[SCENE_REF:]` records an observed handle, `[SCENE_NOT:]` records an explicit or inferred exclusion, and `[SCENE_REVEAL:]` can resolve an anonymous handle only on a committed response; evidence emitted in the same response cannot authorize a death. Active evidence survives summaries. A node transition seals the old frame until a structured summary succeeds. Actor, negative, and sealed-frame caps never evict accepted evidence: overflow latches loudly and all identity-bearing writes fail closed until preserved transitioned evidence is summarized.

Death plus every caused quest/objective/reward mutation travels in a `CANON_TXN_BEGIN/END` envelope. `applyMuts` preflights the whole envelope, applies allowed operations against cloned `worldState`/`memory`, buffers player-visible side effects, and commits state plus a semantic operation receipt only if every handler succeeds. Receipts in `worldState.canonTxns` make exact, formatting-only, delayed, and same-response duplicate replays idempotent while preserving deliberate same-operation multiplicity. A quarantined ID stays poisoned and retains its first failure reason. Independent envelopes remain isolated. Direct NPC merges are proposal-first: only a typed provisional or the exact pair armed by `buildMergeConfirmNudge` may commit.

Combat-close death propagation and direct named-death writes consult the same prior scene evidence. Summary `npcDeaths` entries are objects `{name,handle,sourceTurn,canonTxnId?}`; `w2ValidateSummary` validates every death and death-like chapter assertion before any memory tier writes. After three referential validation failures, the raw window is retained only in bounded `memory.archive.identityQuarantines`; it is not promoted into chapter/event-history canon. Exact field replay: `node dev/replay-w2-incident.js <t1667.tnd>` (the export lives in `testRuns/`). Mutation proof: `node dev/sabotage-w2.js`.

**Entry-13 review hardening (v1.602):** a death REFUSED in a response de-authorizes that same response's quest/reward tags even when the victim was named only inside the stripped tag (the strip previously destroyed the very text the conflict scan read); committed receipts retire `CANON_TXN_RETIRE_TURNS`=12 turns behind a successful structured summary — quarantined receipts NEVER retire — so `CANON_TXN_CAP` no longer permanently kills envelopes at receipt 24; a summary death citing same-turn evidence or a quarantined `canonTxnId` refuses (an unknown id warns and defers to handle evidence); a transition under an already-latched overflow preserves up to `SCENE_REF_SEALED_CAP` more frames in a bounded buffer, and only past that does a frame drop — saying so honestly; `_w2ChapterDeath` also recognizes "X's corpse/remains" and "X bled out". W2 gate: 15/15. Extractor prose tiers returned as ARRAYS normalize to strings before the W6/W2 preflight — an array-valued `chapterSummary` previously bypassed validation entirely (the t1644 class through a type variation); unusable shapes drop loudly, never file.

### #168 W7 relationship axes (v1.601)

`identity.js` owns the one relationship adapter for all state boundaries. A directed edge is `{entity,bond,bondTurn,dynamic,dynamicTurn}`: durable bond and current posture are separate facts, independently authored in each direction. `REL_AXIS_CHOICE_CAP` and `REL_BOND_CHANGE_CAP` are 8; prospective values are capped at `REL_VALUE_MAX`=240. Legacy descriptors migrate verbatim to bond with their original turn and `axisReview`; no regex chooses an axis. Queue saturation never destroys a legacy source row, and portable characters carry unresolved proposals without consulting or mutating the active campaign.

Explicit dynamic writes commit only dynamic. New bonds commit directly; replacing/removing an existing bond or removing the whole pair stages one preimage and needs the exact same tag on a later response. Same-turn duplicates cannot confirm. Compatibility tags queue persistent, deduped axis choices; resolving one candidate leaves competing values intact. W1 `relDowngrades` records remain protective and prompt-visible after pointed delivery mutes. Alias registration, NPC merge, PC swap, campaign load, library import, read-only display, UI, prompt, graph, roster, reciprocity, audit, and core-memory readers route through this adapter. Verification: 28 focused assertions and `dev/sabotage-w7.js` (27/27 source mutations, byte-identical restoration).

**Entry-13 review hardening (v1.602):** re-emitting the EXACT text of a verbatim-migrated over-length bond confirms/classifies it despite `REL_VALUE_MAX` — that text is existing canon, not a prospective write, and refusing it left the migrated row permanently unconfirmable by the very tag the nudge prints; migration drops self-referential edges (`entity === owner`, an NPC-merge fold artifact that rendered as "Ameiko → Ameiko: Wife" in prompt/audit/UI) loudly — pre-images live in the merge archive; portable sheets are exempt from the self-edge drop because their entity keys resolve against a campaign that is not theirs.

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
| 1 – Tone | Choose world tone: High Fantasy, Gritty, Sword and Sorcery, Dark Horror, Political Intrigue, or Custom, plus prose-voice pick. Bottom of step has "⚙ Load blueprint" (the redundant ↩ Import-existing-save input was removed at #23① — File ▸ Import covers it). |
| 2 – Identity | **Merged with Ancestry (TODO #25).** Gender (M/F/NB), age, then an Ancestry picker inline below: 7 ancestries (Human, Elf, Dwarf, Gnome, Half-Blood, Hollow-Born, Tiefling), each with 2–3 subraces; Half-Blood has nested lineage selection via `#lineage-popup`. Picking an ancestry swaps the grid (`#anc-grid-wrap`) for a detail view (`#anc-detail`) in place — "← All ancestries" (`anc-back-detail`/`hideAncDetail()`) returns to the grid without leaving the step. Single Back/Next pair (`id-back`/`anc-next`) for the whole step; `anc-next` validates ancestry + subrace + lineage (if applicable) + flex stat picks before advancing. |
| 3 – Class | 9 classes (Warrior, Rogue, Sorcerer, Ranger, Primal, Paladin, Cleric, Druid, Necromancer) |
| 4 – Attributes | Roll 4d6 drop-lowest (auto-assigned by the class's bible `statPriority`) or Point Buy (27 pts, using `PBC` cost table); stated alignment; auto-suggested deity for Cleric/Paladin/Druid |
| 5 – Finishing Touches | Physical description, backstory, portrait (upload / render from sheet / derive appearance from portrait) |
| 6 – Review | Full character preview + campaign name + starting location + starting level (1–10) + companion selection — **party cap is `PARTY_MAX`=4 total** (player + companions): the creation picker, the mid-game import, and the `[PARTY_MEMBER:\|true]` handler all enforce `partyCompanionCap()` (multiplayer #1 makes playerCount dynamic). `buildSysPrompt` injects a live "PARTY SIZE: N of 3 … FULL" note so the GM doesn't narrate a join it can't make; the `applyMuts` cap is the backstop (over-cap NPC kept as a non-party ally). **Manual departure:** the NPC sheet's "Part ways" button → `partWaysWithCompanion()` flips `partyMember` off (NPC kept, slot freed) and sets transient `worldState.recentlyLeft` → a "PARTY DEPARTURE" note (auto-cleared after ~2 turns, the `recentSwitch` pattern). |

After step 6, if level ≥ 3: archetype picker → stat bump(s) → spell picker → `startGame()`.

**Step 2 uses `<select id="char-gender">` with options M/F/NB** — pronouns have been removed from the character schema entirely.

**Starting languages** are derived automatically in `confirmChar()` from ancestry/subrace and stored in `char.languages[]`:
- All characters start with Common
- `ancLangMap`: elf→Elvish, dwarf→Dwarvish, gnome→Gnomish, tiefling→Infernal, hollow→Umbral
- `subLangMap` (halfblood subraces): half_elven→Elvish, half_orcish→Orcish, half_draconic→Draconic, half_infernal→Infernal, half_fey→Sylvan, half_gnomish→Gnomish

### 2. Game data constants (all in `data.js`)

- `TONES` — 6 tone presets, each with a `vc` (voice directive sent in the system prompt)
- `AUTHORS` — Prose-inspiration voices (#23), each `{id, nm, blurb, vc, profane?}`. `vc` is a style directive injected by `buildSysPrompt` (`proseBlock`); `profane:true` voices swear only when `adultMode` is on. Selected via **Dev Mode ▸ ✍ Prose inspiration…**, read live. **Per-campaign:** stored on `worldState.proseAuthor` (rides the sync blob); `buildSysPrompt` uses it when set, else the device default (`PROSE_K`/`tnd_prose_v1`). Saving in-game pins the campaign AND updates the device default. ⚠ **Never re-add a hard sentence/length cap to STYLE** — capping count makes the model cram everything into one dense sentence ([history](DOC/CLAUDE_HISTORY.md#2-authors--the-sentence-cap-removal)); the STYLE rule forbids cramming and hands length/rhythm to the selected prose voice.
- `ANCS` — Ancestry definitions with `stats`, `traits`, `subraces`, optional nested `lineages`, and `racial_caps` (see below)
- ~~`CLSS` / `ABILS` / `ARCHETYPES` / `CLASS_FEATURES` / `XP_LEVELS` / `STAT_PRIORITY`~~ — **deleted at C6-③ (2026-08-03)**: class chassis, starting abilities, archetypes, level features, XP thresholds and rolled-stat priority all live in `class_bible.js`, served by `classDef()`-family accessors (helpers.js). XP curve is `CLASS_XP_LEVELS` (1–20; L1–10 = the old shipped thresholds verbatim, L11 gate 85000, L20 = 355000)
- `SPELLS` — Spell lists for Sorcerer, Cleric, Druid, Ranger, Paladin, Necromancer (cantrips + levels 1–3). **Necromancer also has a tier 4** (Rigor Mortis, Possess Thrall, Sleep of the Dead) — tiers are intentionally open-ended; creation only ever offers up to tier 3 (`buildPendingSpellPool` caps `maxSlot` at 3), so higher tiers are GM-grantable / high-level content only.
- `ARCH_SPELLS` — Extra spell lists for Eldritch Knight and Arcane Trickster archetypes
- `STAT_BUMP_LEVELS` — `[4, 8]` (levels where +2 stat improvement is awarded)
- `DEITY_MAP` + `DEITY_CENTRIC` — Alignment-based deity suggestions for Cleric/Paladin/Druid
- `DEFAULT_RULES` — 25 hard GM rules always injected into the system prompt (incl. character sheet upkeep, engine-controlled XP/leveling, mandatory NPC registration, quest lifecycle, active-crises-are-quests, player-actions-are-intent, canon-is-not-conversation). The AUDIT_FABLE #19 editorial merge SHIPPED at v1.148 (28→20, zero coverage loss, harness-validated); rules added since are distinct purpose-built additions — see data.js for truth. Reviewed rule-by-rule 2026-08-14 (#16①): no genuine duplicates remain.
- `SPELL_PICK_LIMITS` — Max spells selectable per tier during creation: `{cantrips:2, "1":2, "2":2, "3":1}`
- `SPELL_UNLOCK_PICKS` — **#72 C2 (2026-08-03):** picks granted when a spell tier UNLOCKS in play: `{"1":2,"2":2,"3":1,"4":1,"5":1,"6":1}` (per-class counts are template-iteration material)
- `SKILLS` — Array of 37 skill objects `{id, label, cat}` across 8 categories (Physical, Endurance, Wilderness, Knowledge, Craft, Social, Roguish, Perception). Wilderness includes **Tracking** (WIS/INT), which doubles as urban tailing. **What a level DOES is skills_bible.js (#52)** — the ladder + per-skill canon live there, not here (stats/categories stay in this table; the bible never duplicates them).
- `SKILL_LEVELS` — `["Unskilled","Familiar","Trained","Proficient","Expert","Master"]`
- `SKILL_THRESHOLDS` — `[1, 5, 12, 25, 50]` (cumulative successes to reach levels 1–5)

**`skillLevel(successes)`** returns 0–5 based on `SKILL_THRESHOLDS`.
**`initSkills()`** builds a zeroed skill map `{skillId: 0}` for all 37 skills (derived from `SKILLS`, so adding one needs no change here).

**Racial capabilities (`racial_caps`, single-sourced in the bible):** Ancestries, subraces, and lineages in `ANCS` carry a `racial_caps:[]` list that **references `capability_bible.js` by base name** — the mechanics live ONLY in the bible. Each entry is a bare string (passive/at-will) or `{cap:"Name", use:"1/day"}`. `confirmChar` gathers + dedupes the caps, resolves each via `capabilityLookup`, and pushes bible spells → `char.spells` (`racial:true`) and abilities → `char.abilities`; canonical names mean `buildSpellBibleBlock`/`buildAbilityBibleBlock` auto-inject their canon every turn. `traits[]`/`desc` remain human-readable wizard-preview summaries, NOT the authoritative def. Category `"racial"` = innate heritage traits — drawn by no caster tradition, never in a rolled enemy caster's menu. A coverage-guard test blocks a `racial_caps` key with no bible entry. The old `racial_spells` field is removed.

### 3. State management (in `state.js`)

Three live objects, all persisted to `localStorage` via the `store` wrapper:

| Object | Storage key | Contents |
|---|---|---|
| `worldState` | `tnd_core_v10` | `character`, `world` (location/region/time/weather/threat), `npcs[]`, `questLog[]`, `eventHistory[]`, `combat`, `turn`, W2 `sceneRefs` / `canonTxns` / `identityConflicts` |
| `sessionLog` | `tnd_sess_v10` | Current-session messages sent to the API (`[{role, content}]`); cleared on summarization |
| `memory` | `tnd_mem_v10` | Long-term narrative memory: `npcs{}`, `locations{}`, `quests{}`, `lore[]`, `keyDecisions[]`, `futureEvents[]`, `chapters[]` |

`store` wraps `localStorage` with an in-memory fallback `_m`. Storage key constants (`WSK`, `SLK`, `MEM_KEY`, `AKK`, `RLK`) are defined in `state.js`.

**Transcript compression:** the append-only `worldState.transcript` is the dominant part of a mature save (it caused localStorage quota death on mobile; [history](DOC/CLAUDE_HISTORY.md#3-transcript-compression--the-t308-evidence-v1227)). `saveCore` writes via **`serializeWorldState()`**, which LZ-compresses ONLY the transcript inline (`transcript` → `{__lz:"…"}`); `loadState` reads via **`parseWorldState()`**, tolerant of plain-array transcripts (server blob, `.tnd` import, legacy save). **In-memory `worldState.transcript` is ALWAYS the plain array**; only the localStorage boundary carries the compressed form. Degrades safely to plain JSON if `LZ` is absent. Round-trip engine-tested against real save data — a compressor bug here would CAUSE data loss.

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
  relationships[],        // #168 W7: {entity,bond,bondTurn,dynamic,dynamicTurn}; one directed edge per resolved entity
  saveModifiers[],        // {source, type, amount}
  portrait,               // null | base64 data URL (compressed to max 400×600px JPEG 0.8)
  storyBeats[],           // {text, turn}
  coreMemories[],         // {text, turn, kind, who, camp} — #63: defining moments, witnessed-by-all, portable across campaigns (see §8c)
  partyMember             // bool — always true for the player character
}
```

`worldState` also carries `campId` (string matching `tnd_active_v1`) so the campaign ID survives exports and reimports without creating duplicate campaign slots, `proseAuthor` (per-campaign prose-inspiration voice id — see AUTHORS above), and `tagLog` (#137 — the provenance ring: the last `TAG_LOG_CAP`=40 responses' tag names + mutation labels, riding the save/sync so field forensics can decide emitted-then-purged vs never-emitted).

### 5. API usage

**Provider-agnostic.** `callGM()` routes through the active provider in the `PROVIDERS` table (`globals.js`). Each provider is a self-contained object — `{id, label, keyHint, endpoint, defaultModel, models[], headers(key), buildBody(msgs,sys,maxTok,model), parseResponse(json), parseUsage(json)}` — and `callGM()` picks `PROVIDERS[activeProvider]` and calls its methods. **No `if(provider===...)` branches anywhere else.** This same shape is the intended server-side routing table under the subscription model.

- **anthropic** — `https://api.anthropic.com/v1/messages`; `x-api-key` + `anthropic-dangerous-direct-browser-access: true`; system as a top-level `system` field — **a two-block array for gameplay turns**: `[{stable + cache_control:ephemeral}, {volatile}]` (prompt caching, see §6), plain string for sysOverride calls; response at `content[0].text`. Default model `claude-sonnet-4-6` — **verify this string is current before starting work each session.**
- **openai** — `https://api.openai.com/v1/chat/completions`; `Authorization: Bearer`; system carried as a leading `{role:"system"}` message; response at `choices[0].message.content`. Default model `gpt-4o`. (CORS: OpenAI allows direct browser calls, no special header.)
- **grok** — `https://api.x.ai/v1/chat/completions`; OpenAI-compatible (same body/response), `Authorization: Bearer`. Default `grok-4.3` (see `PROVIDERS` in globals.js for the current list — old grok-2-*/grok-beta IDs are retired).
- **gemini** — `endpoint` is a **function(model)** (`.../v1beta/models/{model}:generateContent`) since Google embeds the model in the URL; `x-goog-api-key` header; system in `systemInstruction.parts[]`, messages in `contents[]` with role `model` (not `assistant`); response at `candidates[0].content.parts[0].text`. Default `gemini-3.5-flash` (retired 1.5/2.0 IDs 404 — see `PROVIDERS` in globals.js for the current list). `callGM()` resolves `typeof prov.endpoint==="function"?prov.endpoint(model):prov.endpoint`.
- **ollama** — `http://localhost:11434/v1/chat/completions`; OpenAI-compatible. **Mixed-content blocked** from an https origin / unreachable from `file://` — only works when the game is served from localhost. Exploration tier.

Shared `TAG_REINFORCE` constant (globals.js) is assigned to every non-Claude provider's `reinforce` (Claude needs none). Model names in each provider's `models[]` should be verified current; the modal's dropdown is fixed to that list. **All four non-Claude adapters are shape-verified but each still needs a live tag-fidelity test (a money turn) once a key is available — same process that surfaced the gpt-4o gotcha.**

**Provider state** (`globals.js`): `activeProvider` (id), `providerKeys` ({id:key}), `providerModels` ({id:modelOverride}). Persisted via `PROV_K`/`PKEYS_K`/`PMDL_K` in `state.js`; `loadProviderSettings()` migrates the legacy `AKK` Anthropic key into the map. Switch providers / set keys / pick model via **File ▸ Dev Mode ▸ 🧠 Language Model…** (`showProviderModal()`). Keys for all providers are retained, so switching back and forth needs no re-entry.

**Per-provider prompt reinforcement:** a provider may carry an optional `reinforce` string; `callGM()` appends it for gameplay turns only, never to `summarize()`. It exists because gpt-4o treats the state tags as optional, silently desyncing the sheet ([history](DOC/CLAUDE_HISTORY.md#5-providers--the-gpt-4o-bring-up-finding-v132)); `openai.reinforce` is a forceful MANDATORY-TAG-DISCIPLINE block — the per-provider tuning the abstraction exists for. Relatedly, the `[GOLD:]`/`[HP:]` parsers are loosened so a model writing `[GOLD:-5 gp]` still parses.

`callGM(msg, sysOverride, maxTok, modelOverride, opts)` is the single API entry point. `opts.noHistory` sends only the given message instead of the full `sessionLog` (used by the action-suggestion call). `opts.kind` tags the call for usage telemetry (defaults: `"turn"` when no sysOverride, `"other"` for utility calls).
- `maxTok` is optional; defaults to `1000`. `summarize()` passes `2000`.
- Appends `msg` to `sessionLog` for the request body but does not push to `sessionLog` itself.

**Usage/cost telemetry (#21):** every provider carries `parseUsage(json)` returning `{in, out, cacheRead, cacheWrite}` (⚠ Anthropic `input_tokens` EXCLUDES cached tokens; the OpenAI shape's `prompt_tokens` INCLUDES them; Gemini reads `usageMetadata`). `callGM` passes the result to `recordUsage(u, kind, model)` (api.js) → `worldState.usage`: totals + per-kind buckets (`turn`/`actions`/`summarize`/`skeleton`/`sync`/`other`) + `costUSD` from `MODEL_PRICING` (unknown models count tokens, contribute $0). UI: **Dev Mode ▸ 📊 Usage & cost…** (`showUsageModal`). The `turn` bucket's In/call average is the before/after metric for prompt caching (#11).

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
4. MECHANICS/dice format + full STATE TAGS instructions + companion-tag instructions + the NAMING clause (#156 — `buildNamingClause`, identity.js: names ARE keys, never reuse an on-file name, the unordered endpoint-pair road form, sublocation-not-parent-baked; campaign-constant by construction, assembled from `IDENTITY_DOMAINS` namingRules)

**VOLATILE half (uncached), in order:**

5. Player identity header + transient switch/departure blocks
6. Character sheet (stats, HP, gold, alignment, abilities, spells, inventory) + conditions, relationships, save modifiers, languages, earned-skill canon (#52 — `buildSkillCanonBlock`: level, bonus, stats, and the skills-bible definition per earned skill; the constant SKILL MECHANICS ladder doc rides the STABLE half beside MECHANICS)
7. **PARTY MEMBER SHEETS** (`partyBlock`) — for each `npc.partyMember && npc.charSheet` (alive), a rich per-companion block: class/archetype/level, HP, stats, abilities, **spells available** (unused only), inventory, conditions (#46), and **relationships (#61/#168)**. W7 renders each directed edge as separately labeled durable **Bond** and **Current dynamic** fields — only `bond` feeds roster authority, the NPC graph, reciprocity, audit, and core-memory detection; `dynamic` is visible scene posture and cannot masquerade as marriage, kinship, oath, alliance, or enmity. `npc.rel` remains the NPC's stance toward the player, never an axis seed; the full adapter contract is the W7 section above. The block header instructs the GM to have each companion act in character with their own kit, track resources via `COMPANION_*` tags, and never contradict the relationship lines. **#137: membership ≠ presence** — split members (`charSheet.splitLoc`) move to a separate PARTY MEMBERS CURRENTLY AWAY block and are de-authorized in `buildSceneManifest`; **#164:** the #133b co-location fold is granularity-aware — bare==bare at a node with known interiors (`locHasInteriors`) is a granularity gap routed to `buildSplitAudit` instead of folding, and every fold that fires stamps `pendingReunion` → `buildReunionNote`. **#140:** every companion line carries alignment and stated-vs-actual tension on genuine divergence. `buildRelationshipAudit` re-grounds durable bonds each `REL_AUDIT_TURNS`=40; UA41 prompts for independently authored reciprocal bonds.
8. World state (location, clock-derived time, weather, NPCs, active quests) + party-size note
9. `memoryTOC()` — compact summary of known NPCs, visited locations, pending events, recent decisions, chapter summaries
10. `memoryNpcDetail()` — full detail on NPCs mentioned in the last 6 session messages (+ RAG excerpts after it, §8b)
11. Combat state block (if `worldState.combat` is set) + event history (last 8 compressed chapter summaries)
12. Defining moments (§8c) + identity REMINDER + style directive — **STYLE stays at the very END on purpose** (uncached tail): end-of-prompt position is load-bearing for prose-voice fidelity (audit #2). The GM writes pure prose — no `[ACTIONS:]` tag (decoupled, see §13).

**Gender in image prompts:** `doRender()` uses `c.gender==="F"?"female":c.gender==="NB"?"androgynous":"male"` — never uses pronouns.

**Age is cosmetic-only (user ruling 2026-08-10):** `age` is injected into ZERO gameplay prompts — neither the player identity header nor PARTY MEMBER SHEETS carries it; only the image-render prompt writers read it. Deliberate, NOT the #46/#61 missing-injection defect class: raw years would demand cross-ancestry age semantics (67 = elderly human, coming-of-age elf). Age-driven fiction belongs in `appear`/ancestry text. Full ruling: TODO.md ▸ Architecture decisions.

### 7. State tag system (`applyMuts`)

The GM embeds hidden tags in every response. `applyMuts(text)` parses them and mutates `worldState` and `memory`. Tags are stripped from displayed text by `cleanTxt()`.

**The authoritative registry is `tag_table.js`** — ~57 handlers; parse, strip, and the GM-facing STATE TAGS doc all derive from one entry each, and tags not indexed below (the W2 `SCENE_REF`/`CANON_TXN` family, clock tags, party split) live there and in their own sections. This index is the quick human reference:

| Tag | Effect |
|---|---|
| `[HP:+/-X]` | Adjust `character.hp`, clamped to [0, maxHp] |
| `[GOLD:+/-X]` | Adjust gold (parse tolerates `[GOLD:-5 gp]`) |
| `[ITEM_GAINED:name]` / `[ITEM_LOST:name]` | Push/filter `character.inventory`; GAINED auto-marks a matching location item taken |
| `[LOCATION:name]` | World move — files to memory+map, clears sublocation AND combat; a child-of-current name refuses loudly, asking for `[SUBLOCATION:]` |
| `[LOCATION_DESC:text]` | Canonical location description — written once, never overwritten |
| `[SUBLOCATION:name]` / `[SUBLOCATION_LEAVE]` | Enter/exit a named area inside the current world location |
| `[TIME:value]` | Phase assertion reconciled into the campaign clock (#131; #142 skip-and-demand across dawn); time renders from `clock.min`, never this stored twin |
| `[WEATHER:value]` | Set `world.weather` |
| `[LOCATION_ITEM:name\|placed]` / `[LOCATION_ITEM:name\|taken]` | Record an item left at / taken from the current node |
| `[LOCATION_STATE:what changed]` | #105 — append a durable state-change note to the current node (cap 3); served in the geo block + the always-present remote roll-up |
| `[NPC:name\|status\|relation]` | Upsert both NPC stores. Death status (`npcDeadStatus()`) stamps durable `npc.dead` — non-death writes then refuse (revival = explicit resurrected status); slain registered foes propagate at encounter close; the extractor's `npcDeaths[]` backstops prose deaths |
| `[XP:N]` | Add XP + `checkLevelUp()`; auto-MIRRORED to every living companion (#178 — a same-response `[COMPANION_XP:]` bonus lands ON TOP, never replaces) |
| `[QUEST:title\|status]` / `[QUEST:title\|status\|desc]` | Upsert quest log (offered/active/completed/failed/declined); completed/failed archive to `memory.quests` |
| `[QUEST_STEP:title\|objective\|done]` | Add or complete an objective (matched by text) |
| `[COMBAT_START:name\|hp\|ac\|atkbonus\|dmgdie\|morale]` | Start combat, or APPEND a foe to the encounter (cap 8; duplicate living name warns) |
| `[COMBAT_STATS:…]` / `[COMBAT_IMMUNE:…]` / `[COMBAT_RESIST:…]` / `[COMBAT_VULN:…]` | Set foe attributes; bind by positional adjacency to the closest preceding COMBAT_START (`COMBAT_ATTR_FALLBACK` otherwise) |
| `[ENEMY_HP:Name\|-X]` / `[ENEMY_HP:-X]` | Damage a foe — named routes exact-then-contains; bare routes single-living → engaged → first-living + warn. hp ≤ 0 → slain |
| `[ENEMY_SLAIN:Name]` | Outcome assertion — narrated kill, the engine zeroes the foe. Named only; unknown name warns, no mutation |
| `[ENEMY_SURRENDERS:Name]` / bare | Mark foe(s) surrendered (bare = all living); a surrendered foe stays in `foes[]` |
| `[COMBAT_ROUND:N]` | Set encounter round |
| `[COMBAT_END:outcome]` | Close the whole encounter (all-foes-down auto-closes even without it) |
| `[ABILITY_GAINED:Name\|Desc]` | Append to `character.abilities` (deduplicated) |
| `[ALIGNMENT:law+1]` / `[ALIGNMENT:good-1]` | Shift the axes (−3..3), recompute the label (#139 seed-from-label; #140 label flips file defining moments + deity-drift nudges) |
| `[ITEM_DEF:name\|…]` | #81 PROPOSAL — queues a player confirm (cap 5, dedupe); Accept = write-once `worldState.itemBible` |
| `[SPELL_USED:name]` | #110 mana spend via `manaPayCast`; racial 1/day keeps the hard `used` gate; a Necromancer overdraws as blood-HP, engine-deducted |
| `[MANA:±N\|cause]` / `[COMPANION_MANA:Name\|±N\|cause]` | #138 EXTERNAL mana effects only — never cast costs (pairing with a cast double-charges); loud no-op on a manaless target |
| `[LORE:fact]` / `[DECISION:desc]` | Append to `memory.lore` / `memory.keyDecisions` (cap 30 each) |
| `[FUTURE_EVENT:what\|when]` / `[FUTURE_EVENT_RESOLVED:what]` | File / resolve a pending event (#29 hygiene: dedupe, scalar `when` → clock schedule, expiry sweep) |
| `[NPC_NOTE:name\|note]` | Append an event note to the NPC record |
| `[NPC_FORGET:name\|person or event]` | Scrub matching knowledge/events so the fact stops re-injecting (the Oubliate teeth) |
| `[NPC_SUPERSEDE:name\|outdated\|truth]` | #57 reveal commitment — retire the stale knowledge line to the archive, record the truth |
| `[RETCON:what was corrected]` | Not a mutation — `rc`-marks the correcting + preceding transcript entries so RAG never serves them (#187: turn-addressed form + the receipted repair tool) |
| `[NPC_PRONOUN:name\|pronouns]` / `[NPC_ALIAS:canonical\|alias]` | Set pronouns / register an alias (every NPC-keyed tag resolves aliases) |
| `[NPC_MERGE:canonical\|duplicate]` | Absorb a duplicate NPC — complete pre-image archived to `memory.archive.identityMerges` FIRST (reversible by construction) |
| `[ALIAS:domain\|canonical\|alias]` / `[MERGE:domain\|canonical\|duplicate]` | #156 generalized identity pair (npc + location); pipe-bearing/unknown-domain operands refuse loudly; `[MERGE:npc\|New Name\|<provisional>]` is the provisional rename flow |
| `[PARTY_MEMBER:name\|true/false]` | Toggle party membership (cap enforced; over-cap NPC kept as a non-party ally) |
| `[DICE:label\|result\|outcome]` | Rendered as a dice block (no mutation) |
| `[SKILL_SUCCESS:skillId]` | Increment the skill counter; toast on level-up |
| `[CONDITION:name\|duration]` / `[CONDITION_REMOVED:name]` | Push/filter `character.conditions` |
| `[RELATIONSHIP_BOND:entity\|text]` / `[RELATIONSHIP_DYNAMIC:entity\|text]` | #168 W7 — write durable bond / current dynamic independently; replacing an existing bond stages a preimage + needs the exact tag re-emitted on a later response; >240 chars refuses |
| `[RELATIONSHIP_BOND_REMOVED:]` / `[RELATIONSHIP_DYNAMIC_REMOVED:]` / `[RELATIONSHIP_PAIR_REMOVED:]` | Axis/pair removal under the same confirmation/preimage contract |
| `[RELATIONSHIP:entity\|descriptor]` / `[RELATIONSHIP_REMOVED:entity]` | Compatibility-only — never guess an axis; queue a bounded explicit W7 choice |
| `[SAVE_MOD:source\|type\|amount]` / `[SAVE_MOD_REMOVED:source]` | Upsert/filter `character.saveModifiers` |
| `[LANGUAGE:name\|fluent/broken]` | Push or update a language |
| `[STORY_BEAT:text]` | Push a story beat + `fileDecision` |
| `[CORE_MEMORY:subject\|text]` | #40 GM-authored defining moment through `fileCoreMemory` — same write path as engine triggers (witnessed-by-all, cap 25, ~200-char clamp) |
| `[COMPANION_HP:]`, `[COMPANION_CONDITION:]`(+`_REMOVED`), `[COMPANION_RELATIONSHIP_BOND/DYNAMIC:]`(+removals, + legacy compat), `[COMPANION_ITEM_GAINED/LOST:]`, `[COMPANION_XP:]` (individual bonuses ONLY — shared awards arrive via the `[XP:]` mirror), `[COMPANION_ABILITY:]`, `[COMPANION_ALIGNMENT:]` | The player-tag twins for a named party member's `charSheet`, all routed via `findCompanionChar(name)` (api.js); the GM is instructed to use the `COMPANION_` prefix when an event affects a party member |
| `[ARC_COMPLETE:title]` / `[ACT_COMPLETE:title]` / `[ARC_CONTINUE:title\|reason]` | Skeleton lifecycle (#127 teeth: drift checks escalate to a forced complete-or-continue fork after two unanswered checks; `buildArcStagingNudge` surfaces never-introduced active arcs). The skeleton block carries the GM-EYES-ONLY knowledge boundary |

### 8. Memory / summarization system (in `memory.js`)

`sessionTokens()` estimates the token count of the **unextracted** part of `sessionLog` (sum of `content.length` / 4, counting only messages past the `worldState.sessKept` marker — see tail retention below). When it hits `SUMMARIZE_AT` (globals.js, 2400), `summarize()` fires before the next player action. On failure the log is KEPT and retried next turn. The bounded strike lives in `worldState.summaryFailure`, is saved immediately, and therefore survives reload/campaign switching. After 3 ordinary failures a raw excerpt is archived as a degraded chapter; after 3 W2/W6 validation failures the source excerpt and validation reason instead enter non-injected `memory.archive.identityQuarantines` and no generated summary/canon consequence is filed.

`summarize()`:
1. Sends the unextracted session log (from `sessKeptStart()`) to the API with a JSON-extraction system prompt (2000 token limit), plus the current pending-events list under an "ANTICIPATED EVENTS" header (#29) and a bounded W6 canonical-identity table (player, sheeted party, bound scene actors, then mentioned explicit-pronoun NPCs; 12 rows / 1600 characters)
2. Parses response as `{chapterSummary, npcUpdates[], loreDiscovered[], decisionsMade[], futureEvents[], resolvedEvents[], npcDeaths:[{name,handle,sourceTurn,canonTxnId?}]}`
3. Runs W6 pronoun/entity validation and W2 referent validation before any write, then files via `applySummaryExtract(extracted)` (sync, engine-testable): chapter summary → `memory.chapters` + `worldState.eventHistory`; NPC attitudes/knowledge; cited deaths; lore; decisions; then futureEvents in the #29 order — expire → file new → resolve
4. Retains a tail of the just-summarized exchanges and saves memory + core

**W6 summary identity validation (#168):** the extractor's identity table uses only explicit canon (sheet gender or an NPC's stored pronouns; the roster's synthetic `they/them` fallback is never authority). The deterministic validator inspects every prose-bearing extraction tier before the first write and rejects only a high-confidence binary subject contradiction in adjacent unquoted sentences — everything ambiguous (mixed actors, quoted speech, possessives, `they`, unknown pronouns, non-adjacent antecedents) abstains, and prose is never rewritten. Era compile/merge applies the same bounded identity prompt + prewrite check so compression cannot re-ratchet the bad chapter class. The recurring-proper-noun/NPC-registration half of the original W6 proposal remains deferred.

**futureEvents hygiene (#29 + #168 W4):** the GM rarely emits `[FUTURE_EVENT_RESOLVED:]` on its own ([history](DOC/CLAUDE_HISTORY.md#8-futureevents-hygiene--the-t198-shalelu-pile-up-29-v1166)). Five deterministic teeth: ① `fileFutureEvent` near-duplicate dedupe (stemmed-token/fingerprint overlap refreshes the existing event's `setTurn` instead of filing a twin); ② a strict scalar `when` files directly to the clock schedule — one lifecycle authority; fuzzy dates remain futureEvents; ③ `expireFutureEvents()` sweeps unresolved fuzzy events older than `FUTURE_EXPIRE_TURNS` (40); ④ the extractor echoes exact finished items into `resolvedEvents[]`; ⑤ `futureResolveAssist` (token overlap + an outcome verb in one fresh-summary sentence) surfaces a GM-decides note — it never resolves automatically. Resolve runs LAST in `applySummaryExtract` so an event set and finished inside one window nets out removed.

**Missing-axis observers (#168 W4):** `commitGmTurn` runs three bounded observers after mutations and clean-text extraction. A high-confidence enclosed-place entry left unfiled for 8 turns, a day-priced journey arriving with a short clock delta, or a money/obligation commitment paired with an interval and no lifecycle tag arms a combat-aware one-shot engine note. The notes ask the GM to file the existing tag or leave state alone; prose never moves a location, advances time, or creates a quest/schedule. The travel note prices only the measured shortfall. Candidate state is one record per axis, not an accumulating history.

**Summarize-tail retention (#28):** `summarize()` must never clear `sessionLog` to zero — with no verbatim window the GM confabulates recalls ([history](DOC/CLAUDE_HISTORY.md#8-tail-retention--the-t160-pin-grab-28-v1165)). `retainSessionTail()` keeps the newest exchanges (`SUMMARY_KEEP_EX`=3 pairs within `SUMMARY_KEEP_TOK`=1600 tokens; the newest pair always survives); `worldState.sessKept` marks how many leading messages were already extracted. `sessionTokens()` counts only past the marker (no re-trip thrash) and the extraction prompt slices from the same marker (no exchange files twice). Stale markers fail safe to zero via `sessKeptStart()`. The RAG skip window (§8b) keys off `sessionLog.length`, automatically covering the deeper live window.

Memory status shown in `#membar` as `~NNNtk`: green dot below 80% of `SUMMARIZE_AT`, amber at 80%+, red at/above `SUMMARIZE_AT`.

### 8b. RAG episodic memory (TODO #27 Phase 1 — see [RAG_MEMORY.md](DOC/RAG_MEMORY.md))

Entity-keyed retrieval over the verbatim transcript — no vectors, no extra API calls, **read-side only** (summarize/chapters/caps untouched). **STANDARD BEHAVIOR** — RAG is what carries a long campaign through NPC-key fragmentation + the cap-30 window; validated in the field ([history](DOC/CLAUDE_HISTORY.md#8b-rag--validation-arc-and-pollution-incidents), AUDIT_t308.md). No toggle UI; `ragEnabled()` survives as a diagnosis-only console escape hatch (`worldState.ragMemory=false`), and `migrateWorldState` clears any explicit `false` on load so an OFF flag can never silently stick to a save.

- **Index:** `logTranscript(role,text,raw)` stamps every GM transcript entry with `e:{n:[npcs],l:location,q:[quest titles]}` parsed from the RAW response tags + a known-NPC name scan (`ragEntitiesFromRaw`, memory.js). Pre-Phase-1 entries are lazily backfilled (name-scan only) during retrieval. Additive fields — no schema bump.
- **Retrieval:** `ragRetrieve(input)` (memory.js) scores GM entries by overlap with the current scene (party + NPCs last seen here + location + active quests) ∪ NPCs named in the player's input (weighted highest); skips the last 10 turns (already in sessionLog); picks ≤3 excerpts ≥3 turns apart within a ~600-token budget; renders oldest-first as turn-pair excerpts under a "PAST SCENE EXCERPTS … the CURRENT state blocks above override anything here" header (the stale-chunk drift guard — excerpts are episodic texture, never current truth).
- **Pollution guards:** ① `rc`-marked entries (the `[RETCON:]` tag marks the correcting entry + its predecessor at `logTranscript` time) and ② **meta exchanges** (player half opening `"GM:"` — recall chatter that can outrank the origin scenes it quotes) are excluded from serving AND from the IDF document set. Plus the **merge-orphan bridge**: write-time `e.n` names deleted by a later `[NPC_MERGE:]` re-resolve through `resolveNpcName` at scoring time — without it, origin scenes go invisible after a merge collapses their key. Untagged pre-`[RETCON:]` prose corrections remain indexed — known residual.
- **Injection:** `buildSysPrompt` VOLATILE half only, after ACTIVE NPC DETAILS. Never touches the cached stable block (engine-tested).
- **TOC diet (same flag):** `memoryTOC` filters LORE to scene-relevant + most-recent-8 (cap 12) and drops the CHAPTER SUMMARIES section (duplicates the STORY SO FAR block). **Flag off must reproduce the pre-feature TOC byte-for-byte** — engine-tested; don't restructure the off-path strings.

### 8c. Core Memory (#40; re-homed by #63) — the permanent tier

Core memories live **on the character schema** — `coreMemories[]` (`{text, turn, kind, who, camp}`, one sentence each), filed **witnessed-by-all** (user ruling 2026-07-16): every present party member carries the moment on their own sheet — the PC↔companion interchangeability contract; moments ride `.char` exports, library imports, and `_switchPlayerCharacter` swaps exactly like relationships/conditions/storyBeats ([history](DOC/CLAUDE_HISTORY.md#8c-core-memory--the-re-homing-40-v1243--63-v1304)). The **DEFINING MOMENTS** block (`buildCoreMemoryBlock`, api.js) is a VIEW assembled from the party's sheets — same-moment copies dedupe; a foreign `camp` stamp renders attributed to that earlier adventure. Injected every turn in the volatile half. Written by engine-detected triggers (`coreMemorySnapshot()`/`detectCoreMoments()`): near-death crossings, companion join/leave, party-member death, and a change to a weighty W7 **bond** — current `dynamic` values are categorically excluded (the t1666 “Owed a favor” failure cannot mint a defining moment). Witnesses = player + living sheeted party members + the subject even off-party/dead. Cap `CORE_MEMORY_CAP`=25 per sheet; overflow archives the oldest loudly. The `[CORE_MEMORY:subject|text]` tag remains enrichment for engine-undetectable revelations and vows.

### 8d. Drift health readout (#17)

Leading indicators over the anti-drift stack, computed at render time by ONE pure function **`healthIndicators(ws)`** (helpers.js, engine-tested) — the membar dot (`#healthdot`, `updateHealthDot` in ui-panels.js) and the detail modal (`showHealthModal`, ui-modals.js) are thin DOM shells over it. Data: the **`worldState.healthLog`** ring (cap `HEALTH_LOG_CAP`=40) — ONE observational entry per gameplay-turn call written by `recordUsage` ({turn, in, cacheRead, rag-served flag via `ragRetrieve._lastServed`, provider}) — plus the existing tagLog/questLog/W2 state. Five indicators, each keyed to a measured failure class: RAG serve rate (n/a young or flag-off; red = mature campaign, 12-turn silence — the #188 confabulation precondition), prompt-cache trend (Anthropic only, its input counts exclude cached tokens; red = 3+ zero-cacheRead turns), zero-tag streaks (warn 3 / red 5 — the gpt-4o desync class), complete-but-uncredited quests (the #20 class), standing anomalies (unresolved identity conflicts, quarantined canon receipts, summary-failure strikes, armed phase mismatch). **Observation-only by construction** — nothing here feeds a prompt or parser. The modal's ⚠ Submit report button files the snapshot through the #16b `sendUserReport` path.

### 9. Map data layer (`memory.map`)

Two-tier location graph stored in `memory.map`: `{nodes:{}, edges:[], lastArrivalFrom:null}` — **plus, since #156 Phase B, the sparse identity overlay `identity.entries`** (`{<key>:{mergedInto?, aliases?, display?}}`): node KEYS are immutable name-born identifiers; repairs tombstone/alias in the overlay and reads resolve via `locResolve`/`locSame` (identity.js). A key's punctuation is HISTORY, never authority — world-vs-sub derives from `node.parent` (`locIsSub`), display leaves via `locDisplayLeaf`. Repaired nodes may carry optional `kind` (`route`/…) and unordered `endpoints[]` (§7.4 — written by the cleanup tool; full topology stays a non-goal).

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

`[COMBAT_START:]` APPENDS a foe (cap 8; duplicate living name ignored + warn). A downed foe STAYS in `foes[]` (panel strike-through + GM aftermath context). Named `[ENEMY_HP:Name\|-X]` routes exact-then-contains; bare routes single-living → engaged → first-living + warn (§7 rows). Attribute tags bind by positional adjacency to the closest preceding COMBAT_START; fallback governed by `COMBAT_ATTR_FALLBACK` (tag_table.js). All foes down auto-closes the encounter even without `[COMBAT_END:]`. Legacy single-enemy saves are wrapped into the foes[] shape by `migrateWorldState`. `#cpanel` shown/hidden by `syncUI()`.

### 10b. Quest system

Quests are GM-emergent and **player-gated**. Live quests live in `worldState.questLog[]` as `{title, status, desc, objectives:[{text,done}], started}`; finished ones archive to `memory.quests{}`.

**Lifecycle:** `offered → active → completed/failed`, plus `declined`. The GM creates quests via `[QUEST:title|offered|desc]` (toasts "⚑ Quest opportunity"). An offered quest is NOT a goal — the GM may not steer toward or advance it. The player accepts via the **Quest Journal** (Accept button → `acceptQuest(idx)` sets `active`) or by agreeing in-story (GM emits `[QUEST:title|active]`). Decline → `declineQuest(idx)` archives as `declined`. On `completed`/`failed`, `archiveQuest()` moves the quest to `memory.quests` and removes it from the live log; rewards come via the GM emitting `[XP:]`/`[GOLD:]`/`[ITEM_GAINED:]` in the same response.

**Anti-drift:** `buildQuestBlock()` re-injects the authoritative ACTIVE (with objective checklists) + OFFERED blocks into every system prompt — the GM reads quest state from data each turn, same pattern as the character sheet. A DEFAULT_RULES entry forbids inventing/renaming/dropping quests and auto-accepting. **Lifecycle teeth (#20)** ([history](DOC/CLAUDE_HISTORY.md#10b-quest-lifecycle-teeth--the-t198-silence-20-v1172)): `buildQuestBlock` adds ① an "ALL OBJECTIVES COMPLETE — emit `[QUEST:title|completed]` with rewards, or add the next objective" instruction when every objective is done, and ② a standing "active crises ARE quests — register unlisted goals now" reminder. Both volatile. `openai.reinforce` includes the quest tags for non-Claude providers. **#191 (v1.630): objectives are OUTCOMES, not rituals** — the ACTIVE block carries the doctrine line (an objective achieved or mooted by ANY means gets `[QUEST_STEP:|true]` in that response), and `buildQuestStaleNudge` (NOTE_BUILDERS) fires a combat-silent one-per-turn review note for an ACTIVE quest with no QUEST/QUEST_STEP tag activity in `QUEST_STALE_TURNS`=30 (`q.lastTouch` stamped by both handlers, any touch clears the `staleNudged` latch; legacy rows read infinitely old — the deliberate post-upgrade review wave; the zero-vocabulary ack is re-emitting `[QUEST:title|active]`). The same staleness feeds the #17 quest indicator as a stalled/overtaken WATCH.

**UI:** world-state sidebar shows quest titles + a `⚑ N opportunities` indicator; clicking opens `showQuestModal()` — Opportunities (Accept/Decline) · Active (☑/☐ objective lists) · History (completed/failed/declined from `memory.quests` — collapsible entries carrying desc + the objective checklist, so a late completion explains itself).

### 11. Level-up system

`checkLevelUp()` called inside `applyMuts()` whenever XP changes:
- HP gain per level: `ceil(hd/2) + 1 + CON_mod` (minimum 1)
- Level rows granted from the class bible as NAMED abilities: class rows (2/5/7/9/11/13/15/17) + the committed archetype's rows (3/6/10/14/18 + capstone 20) via classFeaturesAt()/archFeaturesAt()
- **Spell growth (#72 C2, 2026-08-03):** each tier-unlock level crossed (`spellTiers` — full casters T2@5/T3@7/T4@9/T5@11/T6@15, half casters T2@7/T3@9/T4@13, third casters AT/EK on their archetype schedule T1@3/T2@10/T3@14/T4@18) queues a forced-choice picker (`showSpellUnlockModal`, `SPELL_UNLOCK_PICKS` counts, bench-only pool, base-name dedupe) after the archetype/stat-bump modals; owed picks re-surface before the next turn like owed bumps. Companions AUTO-pick silently (first N unknown bench spells). Fill-phase blank benches skip loudly. No retroactive grants — only unlocks crossed by the level change fire
- Level 3: `showArchetypeModal()`
- Levels 4, 8: `showStatBumpModal()` (+2 to one stat or +1 to two, max 20)

`checkCompanionLevelUp(cs)` called from the `[COMPANION_XP:]` handler — companions auto-level silently (HP gain + class features, same formula) with a toast and system message, but no archetype or stat-bump modals.

**First-encounter memory:** the first time an NPC enters `memory.npcs`, a `firstEncounter` snippet is stored (cleaned response prose, ~280 chars, sentence boundary). Written once, never overwritten; preserved across `[NPC_MERGE:]`. Injected as "First met:" in `memoryNpcDetail()`.

### 12. Alignment drift

`character.alignLaw` and `character.alignGood` are integers clamped to [-3, 3]. `alignLabel(law, good)` maps to 9-point grid. GM shifts via `[ALIGNMENT:]` tags. **#139 (v1.557): the axes SEED FROM the label** (`alignSeedAxes`, ±2 = the threshold coordinate) at creation, and `migrateWorldState` heals any sheet whose axes' own label disagrees with the displayed one (the True-Neutral-snap defect; churn guards for consistent/earned/off-grid states). **#140③ (v1.562):** a LABEL flip files a ★ defining moment for player and companions (snapshot-diff machinery), and `buildDeityDriftNudge` gives a divine-class character whose actual alignment left their `DEITY_MAP` grid one neutral GM note per `DEITY_DRIFT_COOLDOWN`=25 turns (custom deities never judged; no silent mechanical revocation).

### 13. Rendered action suggestions (decoupled — #14)

Action suggestions are **fully decoupled from GM prose**. The GM writes pure narrative — no `[ACTIONS:]` tag, no `*You could…*` line. The STYLE block explicitly tells the GM NOT to emit action suggestions.

**Flow:** after the GM response renders, `generateActions(msgEl)` in `game.js`:
1. Creates 3 placeholder `"…"` buttons (disabled) appended to the narrator message element
2. Fires a follow-up `callGM` call (200-token budget) asking for 3 short action options as a JSON array. The call reuses the main turn's FULL `buildSysPrompt()` — stable half passed BYTE-IDENTICAL (rides the still-warm prompt cache; engine-tested — a perturbed stable silently kills every hit) with `SUGGESTION_MODE_BLOCK` appended to the VOLATILE half only (after STYLE, so the JSON instruction wins the format fight), plus the last 5 exchanges as labeled pairs (`suggestionHistoryPairs`). Runs on the ACTIVE gameplay model (caches are model-scoped; `upgradeModelFor()` survives for the skeleton only). A starved mini-prompt version shipped canon-violating buttons — never regress it ([history](DOC/CLAUDE_HISTORY.md#13-suggestions--the-starvation-arc-14--v1288)). ⚠ User watch flag 2026-07-12: if prose voice/cost/cache health ever seems off, suspect this call first (Usage modal → actions In/call + cache-health lines).
3. Parses the response via `parseSuggestionArray` (tolerates fenced and prose-wrapped arrays), populates each button's text and `data-action`, enables them
4. Stores the options in `worldState.lastActions` via `saveAll()` for reload persistence
5. On failure, silently removes the placeholder buttons (console-warned)

**Reload:** `init()` and `campLoad()` check `worldState.lastActions` first and build buttons via `buildActionButtons(acts)` (returns HTML string). Falls back to `parseActions(clean, raw)` for pre-v1.110 saves that still have the `[ACTIONS:]` tag embedded.

**`parseActions`** (api.js) is retained only for legacy save replay — reads `[ACTIONS:]` tag primary, then `[a|b|c]` without prefix, then the old `*You could…*` prose-parsing. No new responses use it.

- Buttons rendered as `<button class="qa" onclick="sendSuggestedAction(this,event)" data-action="…">`. Tap fills the input (converted to 1st person via `toFirstPerson`, #14a); long-press / Ctrl-click sends (#14a).
- **The affordance gate (#126 → B24 → #141 → #143), game.js:** deterministic validation between model output and rendered buttons — rules: local-cap-remote-target · unowned-capability · dead-npc-interaction · absent-npc direct address · `unreachable-travel` (leading travel verb at a remote world node while sublocated; manifest exits are sublocation/combat-aware, `man.back` = the way out) · `unintroduced-entity` (#143 — the axis is INTRODUCTION not meeting: record signals or a one-time transcript scan stamp `npc.introduced` durably; a zero-presence name rejects). Fallbacks are manifest-built AND revalidated with an axiomatic terminal floor (B24 — "valid by construction" was the bug). The suggestion output is the **#141 scene-check object** `{present, actions}` — forced checking space; the present line logs as `[actions] scene check` telemetry; parseSuggestionArray keeps every legacy tolerance.

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
- **Grok Imagine** (#162) — `xai/grok-imagine-image` / `xai/grok-imagine-image/edit` (img2img via `image_urls`, edit-style API, no strength knob; lowercase `"1k"` resolution; **`maxSeeds:3` as table data** — the over-cap party member is described-only and named in the status line + legend). ⚠ #166 field: the edit endpoint ACCEPTS `aspect_ratio:"4:3"` but output follows the reference portraits' 3:4 when references dominate. **#166: every multiSeed prompt carries a numbered reference legend** (`buildSeedLegend`, game.js) — unlabeled refs made Grok guess the face-to-name mapping
- **Flux [Dev] HQ** (#163) — `fal-ai/flux-lora` / `fal-ai/flux-lora/image-to-image` with **no LoRA attached** (absence test-pinned): the LoRA host serves the full unaccelerated model, which the user's A/B grid showed consistently beats `fal-ai/flux/dev`'s accelerated serving (~2× time, $0.035 vs $0.025). img2img strength 0.6. A real trained style later re-adds the v1.589 entry shape (git history)

**img2img strength is user-tunable (#42):** each model's `img2img` entry declares its `strength` default as data (body fns take it as a param); `img2imgStrength(cfg)` (helpers.js) resolves the player's per-model override (Render Options ▸ "Portrait influence" slider, 0.2–0.95, persisted in `RENDER_STR_K`) over the default, returning `null` for knobless models (slider hides). Only the scene render (`doRender`) reads it — portrait-generation paths keep their fixed 0.75.

When `character.portrait` exists, img2img is used automatically. **#165:** portrait-seed selection is table-driven — a `multiSeed:true` entry (Nano, Grok) gets the whole party's portraits via `collectRenderSeeds` (pure, game.js); single-reference APIs get the player only, and the status line says so. The scene-render request is built by pure `buildSceneRenderRequest` (engine-tested): per-character description FLOOR instead of a party sentence cap (the STYLE-cap lesson again) + an explicit never-omit-gender demand. Falls back to text-to-image if no portrait.

Parameters: `aspect_ratio:"4:3"`, `resolution:"1K"`. `genderWord` derived from `c.gender` (male/female/androgynous).

### 19. Portrait system

`character.portrait` — null or base64 data URL. Compressed via `compressPortrait()` (Canvas resize to max 400×600px, JPEG 0.8) before storage to avoid localStorage quota overflow.

Set from three paths:
1. Scene render → portrait button on render output
2. Portrait modal → "Use as Portrait" button
3. Portrait modal → file upload

**Pan + zoom:** `character.portraitOffset = {x, y, zoom}` (x,y 0..1, zoom ≥ 1) — rendered by `applyPortraitTransform(img, off)` (translate+scale, post-load), NOT `object-position` (it can only pan the single cover-overflow axis). `wirePortraitDrag()` does drag-pan + wheel/pinch zoom + exposes `img._zoomBy(factor)`; `normPortraitOff()` upconverts legacy saves. Player + companion char-sheet avatars and the portrait modal use the offset; small NPC/list/party-HUD avatars stay center-cropped.

**Companion portrait single-source:** an NPC's portrait lives in ONE place — `charSheet.portrait` when a sheet exists (rides inline in the sync blob), `npc.portrait` only for sheet-less NPCs (separate `/portrait` store). All display reads go through `npcPortrait()` (helpers.js, charSheet-first). **Transport:** the `/portrait` collectors read via `npcPortrait()`, and `fillPortraitsFromBlob()` runs on every server reconcile regardless of the turn/PV gates — fill-only (without it, equal-turn devices have NO portrait transport at all). Desync history: [history](DOC/CLAUDE_HISTORY.md#19-portraits--the-sync-sagas).

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
**Endpoints:** ~20 routes — full enumeration in [SERVER_ARCHITECTURE.md](DOC/SERVER_ARCHITECTURE.md) §1.2 (auth, state with the CAS turn guard on POST, campaigns, character/blueprint libraries, allowlisted `/api/prefs/:key` blobs, health). Auth flow is TICKET-based: the popup postMessages a one-shot ticket (or the opener polls it on file://), and the sessionId comes from the claim endpoint.
**Deploy:** `cd C:\Users\hannu\Projects\traffic-and-dragons-server && flyctl deploy --ha=false` — the server repo lives OUTSIDE the OneDrive-synced tree (DOC/todos_completed/PROJECT_ONE_DRIVE_EXODUS.html Phase 4); it is NOT a sibling of the game repo.
**TTS app (#90, M1):** `https://tnd-tts.fly.dev` — a SECOND Fly app in the same server repo (`tts/` subdir; deploy `cd tts && flyctl deploy --ha=false`). `POST /api/tts` {text, voiceId, rate} → audio/wav (warm piper daemons, LRU 3, 10min idle kill; voices HF→3GB volume on first use); auth = the game server's session token proxy-validated via `/auth/me` (10min memo); `/health` unauthenticated (the client's prewarm probe — wakes the auto-stopped machine). Design: DOC/Research/DOC_server_tts.html; Kokoro M2 is TODO #91 (benchmark-gated).

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
- **Verdict/status badge standard (user-approved 2026-07-12)** — when a doc/satellite page needs a colored verdict or status badge (pass/fail/warn, wins/loses, etc.), use the muted-fill pill from `DOC/Research/app_vs_browser.html` (`.lean` classes), NOT an outlined pill or a full-brightness fill (both tried and rejected — outline reads thin, solid fill kills the text). Recipe: background = the accent color cut to **20% of its HSV value** (e.g. `--good` `#7aa86a` → `#182215`), 1px border in the **full-brightness** accent (the rim is what carries the color), text **bold monospace, uppercase, `rgba(255,255,255,.4)`**, `border-radius:12px; padding:2px 10px; font-size:.78em; letter-spacing:1px`. Game-UI surfaces keep the no-pill rule above.
- **`DOC/` holds reference docs — HTML and MD.** Reference material and completed-project records live there; audits live in `audits/`; satellite TOOLS (bible_study.html, bible_editor.html, blueprint-designer.html, bug_tracker.html, author_voice_lab.html, test.html, piper_test.html) stay at root. **Three docs stay at root by design** — `CLAUDE.md`, `TODO.md`, `todo_checkWithFable.md` (the daily working set; `dev/lint-todo.js` also hardcodes `../TODO.md`). Sample `.blueprint` fixtures live in **`samples/`**; personal `.tnd` saves live in **`testRuns/`** (gitignored) — a save cited by an audit must keep its link working, so move the citation in the same commit.
- **Trackers — one job each (consolidated 2026-07-29):** open work lives ONLY in **`TODO.md`** (single source of truth; update the row in the same commit as the fix). **`DOC/BUGS.md`** = field-report pipeline only. **`todo_checkWithFable.md`** = the Fable-review queue (full records archive to `audits/FABLE_REVIEW_RECORDS.md`); while the Fable budget is exhausted, ALL Opus work is documented there (user rule 2026-07-29). **Session handoffs are ephemeral** — open items merge into TODO.md; the file archives as `DOC/HANDOFF_v<ver>.md` when superseded. Completed reviews/audits live under `audits/`.
- **No surface is allowed to be untestable, and no guard is trusted until sabotage proves it** (2026-07-29; origin story in [history](DOC/CLAUDE_HISTORY.md#the-2026-07-29-bible-editor-spiral-origin-of-the-guardrail-rules)). The rules and tools:
  1. **If a surface can't be driven by `dev/run-tests.js`, the first commit that touches it adds a seam.** "I can't click the button" is almost never true — buttons call functions, and functions can be called (the bible editor's seam is `window.__bibleTest` + an OPFS `FileSystemFileHandle`: real handle, no picker, no gesture). Satellites with logic each need one — bible_editor, author_voice_lab, map_viewer, and map_cleanup have theirs; blueprint-designer and bug_tracker still owe one.
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

**Update from library (#161):** "⟳ Update from library" on player + companion sheet headers pulls the library copy's IDENTITY fields into the live sheet behind a per-field old→new preview — `LIB_UPDATE_FIELDS` registry + pure `libUpdateDiff`/`libUpdateApply` (helpers.js, engine-tested; apply recomputes the diff so preview and apply can never drift). Whitelist-only; **progression and play-earned state NEVER flow**; `name` is excluded (identity KEY — renames are #156 territory). Skip rules: lib-undefined skips, explicit `""` applies (deliberate clear), null/"" portrait skips. Modal: `showLibraryUpdateModal` (ui-browsers.js); companion apply mirrors `portraitOffset` onto `wsNpc`. The pull half of the future character-editor loop.

**"Play as X" flow:** all three import paths (file, campaign browser, library) route through `_startImportedCampaign(char)` — a campaign-setup modal asking campaign name, world tone, and starting location (options cloned from the wizard's Review-step select) before resetting state and calling `startGame()`. The character is played as-is; companions are added in-game via Import Character → Add as companion (intro instruction sent via `sendAction(intro,{silent:true})` so it never renders as a player message).

**Mid-game character swap:** `_switchPlayerCharacter(name)` (NPC sheet → "Play as this character") demotes the current PC to a companion NPC and promotes the chosen companion's `charSheet` to `worldState.character`. The POV-handoff fix is two-part: (1) a forceful out-of-character control directive sent `{silent:true}`; (2) `worldState.recentSwitch` makes `buildSysPrompt` re-inject a "CONTROL RECENTLY SWITCHED" block, auto-cleared after 2 turns — the re-injection is the load-bearing part (a single handoff line can't overpower many turns of old-POV history). **Portrait atomicity:** `syncToServer` must never null `character.portrait` — the current PC's portrait rides **inline in the main state blob**, atomic with the state turn. Only sheet-less NPC `n.portrait` is stripped to the separate `/portrait` store. (Desync history: [history](DOC/CLAUDE_HISTORY.md#19-portraits--the-sync-sagas).)

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
- **Verify the FAILURE condition, not a benign case.** A check that can't fail proves nothing. For "3 lines, no partial" the test input is a field that *overflows*; for a parser, the malformed input; for a cap, the over-limit case. Pick the input that would break it — long/empty/boundary/the exact thing reported — and exercise that.
- **For visual/layout work, the screenshot is ground truth; measurements (`getComputedStyle`, `clientHeight`) are a proxy.** When the number and the render disagree, believe the render and go find *why the number lied* (the box the spec measures is not always the box the scroll paints). Don't let a passing metric override the eye.
- **"Measures fixed but reported still broken" → reproduce before you explain.** Treat that gap as the clue, not noise. Never let "cache/environment" be the first explanation for a divergence you haven't reproduced under the user's exact conditions. A user's "confirm it visually" is usually correct — honor it.
- This is the same lesson as **test-first on engine changes**: writing the failing assertion first forces you to define and exercise the break before shipping. Caveat: headless `dev/run-tests.js` can't see CSS layout, so for **visual** bugs the "test-first" equivalent is a scripted `preview_eval` that sets up the edge/overflow case AND screenshots it — not just reads a computed style.

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
