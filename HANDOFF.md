# Traffic and Dragons — Session Handoff

**Date:** 2026-07-01 (second session)
**Deployed version:** v1.145 (`APP_VERSION` in `globals.js`).
**SW cache:** `tnd-v3-20260701d` (`sw.js`).
**Branch:** `master` — **committed, NOT pushed** (v1.144 + v1.145 + audit docs are local only;
origin is still at `1c3bdd2`/v1.143). Push when the user says so.
**Host:** **Cloudflare Pages** — `traffic-and-dragons.pages.dev`.

> Read `CLAUDE.md` first for architecture. This file is just "where we left off."
> This session: a **full-project audit** (30 findings → `AUDIT_FABLE.md`, opens in
> `todo-viewer.html`), a 24-finding fix batch (v1.144), and a small bug batch (v1.145).
> The next real feature is still the **Blueprint Designer** (`BLUEPRINT_EDITOR.md`, decision-locked).

---

## This session's work (committed, NOT pushed)

| Ver | What | Files |
|---|---|---|
| — | **AUDIT_FABLE.md** — full audit: inefficiencies, drift (prose-voice + story/state), kruft. 30 findings, TODO.md table format. Statuses updated in place as fixes landed; user moved done rows into `<!-- completed -->` blocks via the viewer. | `AUDIT_FABLE.md` |
| 1.144 | **24 audit findings fixed.** Highlights: prose author no longer dropped by the spell-pick/stat-bump creation paths (audit #1 — THE voice-evaporation bug); TONE subordinated to VOICE when an author is set (#2); `summarize()` reads near-whole GM turns (was 300 chars, #3), keeps the log on failure w/ 3-strikes raw archive (#5), and routes extractor NPC names through `resolveNpcName` (#6); signed `[XP:+N]` parses (#7); blueprint-seeded locations no longer crash `fileLocation` (#8); reroll/retry keep `worldState.transcript` honest (#9); "Update & Retry" writes `providerKeys[activeProvider]` (#10); `SUMMARIZE_AT`=1200 unifies thresholds (#11); `buildSysPrompt` side-effect-free — name window peeks, cursor advances in `sendAction` (#12, prompt-caching prereq); action buttons get a **sheet digest + latest-scene-only** via new `callGM` 5th arg `opts.noHistory` (#4+#17 — closes TODO Known issue #4); `blankMemory()`/`migrateWorldState()` factories; CLAUDE.md doc-drift pass (#30). | all 10 JS files, `sw.js`, `CLAUDE.md`, `TODO.md`, `AUDIT_FABLE.md` |
| 1.145 | **Known issue #2 fixed** — `showChar()` reset `cs` but never the DOM: old Review step kept `.active`, stale inputs/selects (incl. `char-gender`/`char-age`, which `anc-next` reads from the DOM) leaked into the next character. Now resets step classes, ancestry sub-view, inputs, blueprint banner, `pendingCompanions`. **Review name dup** ("Wood Elf Elf Warrior") fixed per HANDOFF spec — subrace name replaces ancestry name. **TODO #17** Gnome camouflage (all 3 subraces) + **TODO #18** Deep Dwarf superior darkvision 120ft — new characters only. Verified in preview (dirty-wizard simulation + zero console errors). | `ui.js`, `char-creation.js`, `data.js`, `globals.js`, `sw.js`, `TODO.md` |

### Deferred from the audit (reasons matter)
- **#16/#18 — sync payload rework** (debounce `syncToServer`; stop shipping `narrativeHtml` DOM,
  rebuild replay from `worldState.transcript`). Biggest bandwidth win left. **Needs a 2-device test.**
- **#19 — DEFAULT_RULES editorial merge** (28 rules → ~18–20). Behavior-affecting; wants its own session
  with a playtest-harness before/after, then feeds TODO #11 (prompt caching) as the frozen prefix.
- **#24** `_applyBlueprint` dead `#tone-grid` selector — belongs to the Blueprint Designer build (§5.2).

---

## Open threads / "don't get burned"

- **NOT PUSHED.** v1.144+v1.145 are local commits only. First act when told to push: `git push`.
- **Blueprint Designer is still the next real feature.** `BLUEPRINT_EDITOR.md` decision-locked. Build order:
  §5.1 load-time normalizer first; §5.2 dead `#tone-grid .card` selector; §5.3 Runelords fixture invalid
  `"tone":"high_fantasy"`; §5.5 `buildBlueprintFromGame` only captures `knowledge[0]` (lossy).
- **Two stale worktree sessions can be archived:** "Fix duplicated subrace+ancestry name on Review step"
  (superseded by v1.145) and its worktree `.claude/worktrees/nostalgic-franklin-5aaeba`. The stalled
  "Fable project audit" scheduled-run session was already archived.
- **Manual verification worth doing next real play session** (list at the bottom of `AUDIT_FABLE.md`):
  caster creation keeps the chosen prose voice; blueprint travel doesn't error; action buttons stay
  sheet-legal; summarize failure shows "will retry" and keeps the log.
- **Car Mode still needs a real-device pass** (Bluetooth priming, notch clearance). TODO #2/#19.
- **Runelords save file** `Rise_of_the_Runelords__Ammut__Ammut_t54.tnd` untracked in repo root —
  personal save, do NOT commit. **`AUDIT_RESULTS.html` staged-deleted** — pre-existing, left untouched.

---

## Standing gotchas reconfirmed this session

- **SW is cache-first — bump `CACHE` in `sw.js` on EVERY code-changing commit.** Hit stale-cache repeatedly
  in the preview this session; the fix in-preview is unregister the SW + clear caches, then reload:
  `navigator.serviceWorker.getRegistrations()→unregister`, `caches.keys()→delete`, `location.reload()`.
  Note the SW served a **stale `todo-viewer.html` even though it's not in `APP_SHELL`** — clear caches when
  a dev page looks stale too.
- **`preview_screenshot` was flaky all session** (repeated 30s timeouts while the page was fully responsive
  to `preview_eval`). When it hangs, **verify via DOM measurement** (`getBoundingClientRect`, computed
  styles, class checks) instead — it's more precise anyway for spacing/colors.
- **Preview `localStorage` persists** across `preview_start`/`stop`; clear stale `tnd_*` keys before trusting
  `worldState`/screen state.
- **Model:** confirm `claude-sonnet-4-6` (`MDL` in `globals.js`) is still current before API work.
- **ES5 only** (`var`, no arrow/const/let/template-literals; `async/await` only in the API-facing functions).
  A pre-write hook (`.claude/hooks/es5-check.js`) enforces it and flags arrows even inside comments.
- **Three file menus** (`fm-`/`cs-fm-`/`api-fm-`) must stay in sync when adding items.
- **Always commit; don't push until told.** Bump BOTH `APP_VERSION` (`globals.js`) and `CACHE` (`sw.js`) on
  every commit that changes game code; dev-only files not loaded by `index.html` don't need a bump.
- **New this session (memory saved):** when I ask the user a question, wait for the *complete* answer before
  acting — don't race ahead on the first piece of a multi-part reply.

## Playtest harness (unchanged)

`dev/playtest-harness.js` (not loaded by `index.html`) drives N real GM turns against a throwaway character
via `preview_eval`. To invoke: tell me (1) which campaign (fresh throwaway — pick author/tone, or existing
save) and (2) how many turns. Full mechanics in the file header.

## Deploy

- **Cloudflare Pages** auto-deploys from `pmegow/traffic-and-dragons` on push to `master` (no build,
  output = repo root).
- **Server:** `cd traffic-and-dragons-server && flyctl deploy --ha=false`.
