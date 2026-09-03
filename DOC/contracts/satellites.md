# Satellites, menus and the error reporter

**Read this when** you touch a satellite page, the File menus, the bug report path or the SW allowlist.

Split out of CLAUDE.md on 2026-09-03 (#310); the map there links here. Version stamps and history links inside are the record as written — the contract lines are current unless a newer commit says otherwise.

## Files

### error-report.js

Status: ✅ Active (#16)

Mobile error reporting — `reportError(ctx,msg,detail)` POSTs runtime errors to a Google Apps Script webhook that emails pmegow@gmail.com (the mobile console is invisible; this is the channel). `ERROR_WEBHOOK_URL` at top (empty = disabled). Flood control: 30s debounce + 10/session cap + reentrancy latch. Wires `window.onerror`/`onunhandledrejection` at load (browser only); called from the turn/re-roll/skeleton/actions/summarize catches and the Piper narration-death crumb. Transport seam `_erSend`/`_erPost` is test-stubbed. **#16c diagnostics:** per-page-load `ER_SESSION_ID`, `erCrumb(evt,data)` — a bounded localStorage breadcrumb ring recovered at next boot so a PROCESS KILL's final seconds survive — and `erDiagBlock()` appended to every crash `detail`. All of it rides in `detail` ON PURPOSE — the GAS sheet is a fixed 15-column user-deployed schema; a new column means a redeploy + migration. **#16b user reports:** `sendUserReport`+`erReportContext`+`ER_REPORT_HINTS` (message-keyword → extra state; never keys/tokens) here; the modal + DOM-screenshot capture (`showBugReportModal`/`_bugCapture`, vendored `/vendor/html-to-image/` — `toSvg` only; the lib's `toJpeg` hangs in embedded Chromium; `_bugShotFilter` + `imagePlaceholder` keep one bad img from rejecting the whole capture) in ui-modals.js; File ▸ ⚠ Report bug (game screen only)

### bible_study.html

Status: ✅ Active

Satellite viewer (TODO #10) for the `*_bible` registries — open directly (like `blueprint-designer.html`, NOT in the SW app shell). Loads the bible data + helpers, renders every spell/ability via the shared `bibleCardHTML` and every skill via `skillCardHTML` (#52 — Skills section with the level-ladder header); live name/text filter. **Deliberately READ-ONLY** (user call 2026-07-27): the bibles may become player-facing, so the mutable surface lives in `bible_editor.html`, never here

### bible_editor.html

Status: ✅ Active (#72)

**Dev-only authoring satellite** for the `*_bible` files — separate from the read-only bible_study by design (bibles may go player-facing; players must never find a mutable surface). Opens a bible from disk and **SAVES BACK OVER IT** via the File System Access API; a lapsed handle re-grants through a **Reconnect** button inside a click gesture (the #30 permission lesson); no FSA → file-input import + download fallback, loudly. **Bible types are a REGISTRY** (`BIBLE_TYPES`: detect/parse/serialize/render) — adding a bible is ONE entry. Three types ship: **class_bible** and **item_bible** (machine-regenerated wholesale) and **capability_bible** (HAND-COMMENTED — untouched entries re-emit as their original source lines so a save is a minimal diff; contract-pinned BOTH ways, unedited round-trip AND all-dirty emit). Draft persists to `tnd_bible_editor_draft_v1` (old drafts MIGRATED, never discarded). Test seam: `window.__bibleTest`

### author_voice_lab.html

Status: ✅ Active (#104)

**De-branding test satellite** for the prose-voice feature (open directly; network-first in sw.js). Tests whether 12 shared attribute dials (analysis in [DOC/Research/DOC_author_voice.md](DOC/Research/DOC_author_voice.md)) re-create each author's voice with NO author name in the prompt. One row per `AUTHORS` entry (+ a Custom learning row): reference passage, dial sliders at rated baselines, dial-only / +devices / distilled-name-free / author-name-control arms (`VOICE_DISTILLED` exists because a name acts as a pointer into the model's corpus while a dial list is a description it averages). Loads globals.js + data.js read-only; slider tweaks persist in `tnd_voicelab_v1`; `?stub=1` fakes the model call. Seam: `window.__voiceLabTest`; VOICE LAB CONTRACT (run-tests.js) pins lockstep-with-AUTHORS, name-free prompts, and the sw.js allowlist entry — sabotage-proven

### map_viewer.html

Status: ✅ Active (#154)

Satellite viewer for the campaign's **location graph** — the GM's actual working geography as an interactive force-layout SVG (hand-rolled, no deps): world nodes sized by visits, sublocations clustered on parents, first-travel edges, party position ring, split badges, **ghost nodes** (edge-referenced but never filed — real rot). Click a node → its full record. READ-ONLY by construction (zero localStorage writes). Data sources in precedence order: `window.__mapTest` seam (headless-drivable) → imported `.tnd`/state JSON → same-origin localStorage (the LIVE view). ⬇ Export SVG. Open directly like bible_study; network-first in sw.js

### map_cleanup.html

Status: ✅ Active (#156 Phase B)

**Dev-only guided location-repair satellite** (bible_editor precedent — the mutable surface lives here, map_viewer stays read-only forever). Loads a `.tnd` file OR the LIVE active campaign, runs `locRepairCensus` (typed evidence; every group starts **undecided** — classification is human, per pair, never a batch), classify controls (merge/reparent/alias/leave; split and pipe-bearing plans ride the advanced plan-JSON box — allocation is inherently human), **dry-run diff** before a double-confirmed APPLY through the shipping executors (pre-images archived, reversible by construction). `.tnd` mode downloads `*_REPAIRED.tnd`; live mode writes back via `saveAll()`. Test seam `window.__cleanupTest`. Network-first in sw.js

### character_editor.html

Status: ✅ Active (#62)

The STANDALONE character editor — every v10 field through ONE `FIELDS` + ONE `LISTS` registry (adding a field = one entry), class/archetype pickers from the class bible, portrait upload at the game's 400×600 JPEG contract, .char load/save in the game's own wrapper (imports run the game's migrations), account library load/save. Edits a PORTABLE sheet, never a campaign: no game.js/ui-*.js, no state writers (CHARACTER EDITOR CONTRACT). Unknown names warn, never block (owner ruling: no cheat-guard). Seam `window.__ceTest`; network-first in sw.js

### home.html

Status: ✅ Active (#290)

The player's HOME PAGE — Play / Designer / Reference cards, the CURATED shelf (`samples/catalog.json`, originals only; licensed fixtures refused by contract), and the signed-in account blueprint library. Play hands a blueprint to the wizard through the one-shot `HOME_PENDING_BP_K` key (globals.js) consumed by `consumeHomeBlueprint` → `_applyBlueprint`; **#307 quick start:** three pre-made heroes (`samples/characters/`) + a curated story ride `HOME_PENDING_QS_K` → `consumeHomeQuickStart` → `startGame` directly (the wizard is the custom path); a first-turn overlay follows the opening scene once per device; Table Talk answers from `TABLE_TALK_FAQ` (data.js); Open-in-designer seeds the designer's draft slot. Reads only (no game.js/ui-*.js, no state writers — HOME PAGE CONTRACT); seam `window.__homeTest`; network-first in sw.js

### bug_tracker.html

Status: ✅ Active (#71)

Satellite viewer for the **bug-triage pipeline** over the #16 reports. GAS v2 (`dev/gas-error-webhook.gs`, user-deployed) dual-writes every report: email + Google Sheet + secret-gated `doGet` JSON feed. Tracker = `DOC/BUGS.md` (format contract in its header; report bodies fenced as UNTRUSTED data); ops = the `/bugs` skill: `sync` / `investigate` (dispatches the Read/Grep/Glob-only bug-investigator agent — mechanical injection containment) / `act` (gated on findings; drift-surface flag → Fable policy). Viewer buttons COPY the /bugs command to clipboard; the live server section reads the doGet feed directly (secret via 🔑 → localStorage). ⚠ ALL report-derived text renders via `textContent` — never innerHTML; **new satellites must be added to sw.js's network-first allowlist or the SW pins them stale**. Feed secret lives in gitignored `.claude/bugs.local.json`

## 15. File menu

Present on both `#game-screen` (in `#topbar`) and `#char-screen` (top-right above step dots).

**Submenu presentation:** drawers open as **side flyout panels on desktop** — the toggle measures the parent item's rect BEFORE opening and flies toward whichever side of the screen has more room (away from the closest edge; leftward is the CSS default, rightward the inline override). At ≤768px they fall back to the **inline accordion** — positioning lives on the `.fm-subwrap`/`.fm-sub` CSS classes (index.html), open/closed state is the inline `display` the JS toggle flips. Flyouts reset closed whenever a File menu opens (`resetFileSubmenus`).

**Game screen items (cascading drawers):** Sync state (mobile), World state (mobile), Render prompt (mobile) | Campaigns… | Car Mode | **💾 Save / Load ▶** (Save Game, Load Game, Export Character, Import Character, Export as Blueprint, 📜 Export Narrative) | ☁ Blueprint Library… | **⚙ Settings ▶** (labelled Settings since #307; operator rows inside it hide for non-admins, #289) (Voice Settings…, **📖 Narrative options ▶** (Narrative rules, ✍ Prose inspiration…, 18+ Adult content), Language Model…, 📊 Usage & cost…, Render Options…, Large text, Auto-send voice, Legacy characters, campaign folder, Connect/Disconnect server, Clear cache) | Clear cache & reload | New Game. Cascading toggles share one wiring loop in `wireButtons` (`devmode/devmenu`, `saveload/saveloadmenu`, `narropts/narroptsmenu` — narropts nests inside Admin). **The Blueprint Designer has NO menu entry by user preference** — open `blueprint-designer.html` directly.

**Char screen items:** Same full list, but Sync state, World state, Render prompt, Save Game, Export Character, and New Game are greyed out (`opacity:0.4; pointer-events:none`) — no active game yet.

Both menus share the same underlying functions. `updateServerUI()`, `loadAdultMode()`, and `toggleAdultMode()` sync state across both menus simultaneously.

**File naming:** `buildFilename(type)` — format `[campName]_[charName]_t[turn].[ext]`. `worldState.campName` is set once at campaign creation and never changes.

(There is no auto-export narrative — `worldState.transcript` is the complete cross-device narrative record and the memento/story compiler #219 reads from it.)
