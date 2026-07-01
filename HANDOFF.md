# Traffic and Dragons — Session Handoff

**Date:** 2026-06-30
**Deployed version:** v1.137 (`APP_VERSION` in `globals.js`)
**SW cache:** `tnd-v3-20260629f` (`sw.js`)
**Branch:** `master` — **code is pushed** through v1.137 (`06fbe61`). **3 doc-only commits are committed but NOT pushed** (the Blueprint Designer planning docs — `11c6c35`, `c7094c5`, `f53ae54`).
**Host:** **Cloudflare Pages** — `traffic-and-dragons.pages.dev` (auto-deploys on push to `master`).

> Read `CLAUDE.md` first for architecture. This file is just "where we left off."
> The next real feature is the **Blueprint Designer** — spec is fully locked in `BLUEPRINT_EDITOR.md`.

---

## The through-line this session: fighting narrative & content drift

The dominant theme was **prose voice and content drifting to mush over a long campaign** (a 35-turn
Runelords playtest "devolved from the greatest campaign in RPG history into an accounting simulator in
a beige suit" — flat functional prose about a ledger). We diagnosed it and shipped a stack of fixes.

**Root causes identified:**
1. **Instructions lose to examples.** The `sessionLog` (the model's own prior prose) is the real
   gravitational field; a STYLE directive can't overpower N turns of drifted output.
2. **The skeleton flattened the author DNA at birth and then re-injected *generic procedure* that
   contradicted it.** `buildSkeletonBlock` emitted "investigation → gather clues, interrogate, piece
   together evidence" every turn — authoritative, repeated, and pulling toward proceduralism. **That
   generic type-hint was the smoking gun behind the ledger.**

**What shipped (v1.132 → v1.137):**

| Ver | What | Files |
|---|---|---|
| 1.132 | **Author content DNA.** Each `AUTHORS` entry gets a `contentDNA` field (story structure/arc shape/NPC behavior/moral texture — distinct from `vc` prose style). Injected into `generateSkeleton()` at creation AND as a `NARRATIVE DESIGN` block per turn in `buildSysPrompt()`. | `data.js`, `api.js`, `game.js` |
| 1.133 | **Campaign DNA creation step.** Wizard step 1 renamed "Campaign DNA" — two dropdowns (World Tone + Prose Voice) replacing the tone card-grid. Live blurb shows tone magic/violence + author one-liner. Author threaded through all `startGame()` paths → `worldState.proseAuthor` + device default. | `index.html`, `char-creation.js`, `ui.js`, `game.js` |
| 1.134 | **Chapter summaries written in the author's voice.** `summarize()` injects the author's `vc` into the `chapterSummary` field so `eventHistory` ("STORY SO FAR") re-injects voice instead of baking in drift. (Partial fix for root cause #1.) | `memory.js` |
| 1.135 | **Blueprint starting location enforced.** `applyBlueprint()` overrode region but never `world.location` — the wizard default ("Crossroads of Ashenveil") silently won. | `game.js` |
| 1.136 | **Campaign name format** `Blueprint (Char, Companion)` when a blueprint is loaded — updates live as companions are added. Distinguishes 3 same-named campaigns. | `char-creation.js` |
| 1.137 | **Remedy A — encode DNA into the skeleton arcs (the big one).** `generateSkeleton()` now requests a per-arc `dnaHint` (one concrete sentence on how to run THAT arc in the author's sensibility) when an author is set. `buildSkeletonBlock()` surfaces the active arc's `dnaHint` as a `HOW TO RUN THIS ARC` line and **SUPPRESSES the generic type-hint when a dnaHint exists** — killing the contradiction. Graceful fallback: no dnaHint (blueprints, old saves, parse-dropped) → generic hint. Verified both paths live. | `game.js`, `api.js` |

**Also shipped just before this arc:** v1.131 **Car Mode** — fullscreen audio-first play overlay
(File ▾ → 🚗 Car Mode): portrait, party HP dots, state-aware tap button, TTS→mic auto-loop, Media
Session API for steering-wheel buttons, desktop Space/→/←/Esc shortcuts. **Ready to test — needs a
real Android/Bluetooth road test.**

---

## Drift work — what's DONE vs. STILL OPEN

- ✅ **Content drift** (the ledger) — addressed by Remedy A (v1.137). The strong axis.
- ⚠️ **Voice erosion from sessionLog momentum** — only *partially* addressed (v1.134 styles the
  summarized history, but the rolling raw `sessionLog` is still un-styled). This is **"Remedy B"** and
  is NOT built. If a fresh Abercrombie campaign keeps its plot teeth but the *prose* still goes beige,
  Remedy B is the next lever: **pin a short, non-drifting voice exemplar in the system prompt** (fight
  examples with examples). The user explicitly rejected "inject synthetic messages into sessionLog"
  as wall-throwing — do NOT propose that again.
- ⚠️ **Existing saves don't benefit.** The current Runelords save's skeleton was generated pre-v1.137,
  so it has no `dnaHint`s and uses the generic fallback. **Remedy A only shows on a FRESH campaign.**
  Best test: start a new Abercrombie campaign, play past the first summarization cycle (~1200 session
  tokens), confirm arcs keep their teeth instead of collapsing to errand-running.

---

## Next feature: Blueprint Designer (spec locked, nothing built)

**Read `BLUEPRINT_EDITOR.md`** — it's a complete, decision-locked handoff. Summary:

- A **stand-alone** surface (its own screen + File-menu entry, D5) to create/edit/generate campaign
  blueprints without hand-writing JSON. Three modes: **Manual**, **Generate** (absorbs old TODO #5 —
  guided prompts → LLM → editor), **Edit existing**.
- **Decisions locked:** D1 canonical schema keeps `author`+`tone`; D1b canonical format string
  `tnd-blueprint-v1` (normalizer accepts legacy `tnd-campaign-v1`); D2 dnaHint gets both a
  hand-editable field AND a generate button; D3 TODO #5 absorbed; D4 cloud save overwrites by slug;
  D5 stand-alone surface.
- **Build order:** §5.1 first — the **load-time normalizer** gates everything (load + round-trip).
- **Bugs to fix in the same surface:** §5.2 `_applyBlueprint()` (`ui.js:712`) still targets the
  dead `#tone-grid .card` (broken since the v1.133 dropdown swap — blueprint tone hasn't applied
  since); §5.3 the shipped Runelords fixture has invalid `"tone":"high_fantasy"` (valid: `high`);
  §5.5 `buildBlueprintFromGame` only captures `knowledge[0]` as NPC notes (lossy).
- **Reference fixture:** `rise_of_the_runelords.blueprint`.

---

## TODO snapshot (see `TODO.md`)

| # | Status |
|---|---|
| 2 (Car Mode) | Ready to test — v1.131. Needs real-device road test. |
| 5 (Campaign Designer) | **ABSORBED** into the Blueprint Designer (Generate mode). |
| 25 (new) | Merge Ancestry into Identity step — pending. |
| 26 (new) | Augment Deep Dwarf darkvision — pending (scope TBD). |
| 27 (new) | Add camouflage to Gnome racial benefits — pending. |
| Known issue #4 | **"New Game" drops user on the OLD campaign's Review (step 7)** instead of step 1. Suspect `cs`/step-counter not fully reset in `newGame()`/`showChar()`. Reported v1.133, not investigated. |

---

## Pending / known "don't get burned"

- **Push the 3 doc commits** if you want them on the remote (they're local-only right now).
- **`AUDIT_RESULTS.html` shows as staged-deleted** in `git status` — pre-existing, unrelated to this
  session's work.
- `parseActions()` in `api.js` is legacy-only (pre-v1.110 save replay). Harmless.
- Service worker is **cache-first** — you MUST bump `CACHE` in `sw.js` every code commit or the deploy
  won't show. When testing on `localhost`, the SW intercepts too; unregister via DevTools or the
  `sw+caches cleared` + hard-reload trick if files look stale (used it this session in the preview).
- **Preview gotcha:** `preview_eval` runs against the already-loaded page. After editing a `.js` file,
  reload (and clear the SW) before re-testing, or you'll test stale in-memory code.

---

## Conventions

- **ES5.1+** — `var`, no arrow/const/let/template-literals. `async/await` only in the API-facing
  functions. ES5.1 builtins + `Object.assign` are OK.
- **Always commit; don't push until told.** Pushing to `master` auto-deploys via Cloudflare Pages
  (the user tests locally first to save deploy cycles).
- **Bump BOTH** `APP_VERSION` (`globals.js`) AND `CACHE` (`sw.js`) on every code-changing commit.
- **Answer questions before acting** — when the user asks a question, answer it first; they're often
  weighing options, not issuing a directive.
- **Three file menus** (`fm-`, `cs-fm-`, `api-fm-`) must stay in sync when adding items.
- Personal save files (`*.json`/`*.char` game exports) are **not committed**.
- **Model string:** confirm `claude-sonnet-4-6` (`MDL` in `globals.js`) is current before API work.
- End every update reply with the current version on its own last line.

## Deploy

- **Cloudflare Pages** auto-deploys from `pmegow/traffic-and-dragons` on push to `master` (no build,
  output = repo root).
- **Server:** `cd traffic-and-dragons-server && flyctl deploy --ha=false`.
