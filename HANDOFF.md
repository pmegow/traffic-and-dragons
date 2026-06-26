# Traffic and Dragons — Session Handoff

**Date:** 2026-06-26
**Deployed version:** v1.110 (string in `updateMemStatus()` in `ui.js`)
**Branch:** `master` — committed, not yet pushed.
**SW cache:** `tnd-v3-20260626g` (`sw.js`).
**Host:** **Cloudflare Pages** — `traffic-and-dragons.pages.dev`.

> Read `CLAUDE.md` first for architecture. This file is just "where we left off."

---

## What shipped this session (v1.106 → v1.110)

| Ver | What |
|---|---|
| 1.106 | **#25 Finishing Touches step** — new wizard step 6 (Attributes → Finishing Touches → Review). Appearance + backstory textareas moved here from Identity. Portrait section: upload, render from sheet (fal.ai), derive appearance from portrait (Claude vision). Mark field removed. Three bugs fixed: portrait pan/zoom wiring (`wirePortraitDrag` in `refreshFtPortrait`), label text ("Derive physical description from portrait"), companion browser cloud library access (Library/Local segmented toggle via `storageAdapter.listCharLibrary()`). |
| 1.107 | **Skeleton fix (token limit)** — `generateSkeleton()` JSON truncated at 2000 token limit. Raised to 4000. |
| 1.108 | **Skeleton fix (trailing commas)** — still failing with `Expected ',' or ']'`. Raised limit to 8192. Added `cleaned.replace(/,\s*([}\]])/g,"$1")` before `JSON.parse`. |
| 1.109 | **beginAdventure prompt alignment** — intro prompt still said `*You could [A]; [B]; or [C].*`, conflicting with system prompt's `[ACTIONS:]` tag instruction. Aligned to tag format. (Superseded by v1.110.) |
| 1.110 | **#14 close-out: action buttons fully decoupled from GM prose.** GM writes pure narrative — no `[ACTIONS:]` tag, no `*You could…*` line. `generateActions(msgEl)` creates 3 placeholder buttons, fires a lightweight follow-up API call (200 tok, `sysOverride`) for 3 JSON options, populates buttons async. Stored in `worldState.lastActions` for reload. `parseActions` retained only for pre-v1.110 save replay. STYLE block, `TAG_REINFORCE`, and `beginAdventure` all updated. **Side benefit:** removing `[ACTIONS:]` from STYLE freed model attention — prose voice fidelity noticeably improved. |

---

## Key architectural changes

### Decoupled action suggestions (v1.110, CLAUDE.md §13)
- `generateActions(msgEl)` in `game.js` — 3 placeholder "…" buttons → lightweight `callGM` (200 tok, `sysOverride`) → JSON array of 3 short strings → populate buttons → `worldState.lastActions` via `saveCore()`
- `buildActionButtons(acts)` — renders buttons from a stored array (reload path)
- `sendAction`, `beginAdventure`, `rerollLast` all call `generateActions(narEl)` after rendering prose
- `init()` and `campLoad()` in `ui.js` — check `worldState.lastActions` first, fall back to `parseActions()` for old saves
- STYLE block: "Do NOT end your response with suggested actions"
- `TAG_REINFORCE`: same instruction for non-Claude providers

### Wizard step changes (#25, #26, #27)
- 7 steps (8 with perks): Tone → Identity → Ancestry → Class → Attributes → Finishing Touches → Review
- Identity step: only name, gender, age (appearance/backstory/mark moved out)
- Finishing Touches: appearance, backstory, portrait (upload/render/derive)
- `cs.portrait` and `cs.portraitOffset` flow through `confirmChar()` to the character object

---

## Files changed this session
- `game.js` — `generateActions()`, `buildActionButtons()`, updated `sendAction`/`beginAdventure`/`rerollLast`, skeleton token limit 8192 + trailing comma strip
- `api.js` — STYLE block rewritten (no ACTIONS instruction)
- `globals.js` — `TAG_REINFORCE` updated (no ACTIONS instruction)
- `ui.js` — reload path uses `worldState.lastActions`; version v1.110
- `char-creation.js` — `refreshFtPortrait()` wires `wirePortraitDrag`; `confirmChar()` carries `portraitOffset`
- `index.html` — Finishing Touches step HTML, derive label fix
- `sw.js` — cache `tnd-v3-20260626g`
- `CLAUDE.md` — §13 rewritten for decoupled architecture
- `TODO.md` — #14 updated to v1.110, #25 marked done, #29 unblocked

---

## TODO status snapshot

| # | Status |
|---|---|
| 14 | ✅ Done (v1.110) — fully decoupled action generation |
| 25 | ✅ Done (v1.106) — Finishing Touches step |
| 26 | ✅ Done (v1.104) — Specializations rename |
| 27 | ✅ Done (v1.104) — Personality page removed |
| 28 | ✅ Done (v1.104) — Blueprint locks location |
| 29 | Unblocked — #25 landed |

---

## Pending / known

- `parseActions()` in `api.js` is legacy-only (pre-v1.110 save replay). Harmless, removable once old saves age out.
- `generateActions` doesn't push to `sessionLog` — ephemeral by design (keeps conversation clean).
- Skeleton generation should be confirmed on a fresh campaign (token + comma fixes applied but only tested once).
- CORS PUT errors in console (fly.dev from `file://` origin) — pre-existing, unrelated.
- `DEFAULT_RULES[9]` in `data.js` still references "the 'You could...' suggestion line" as a length guideline — cosmetic only, doesn't affect behavior.

---

## Conventions / "don't get burned"

- **ES5.1+** — `var`, no arrow/const/let/template-literals. `async/await` only in API-facing funcs. ES5.1 builtins + `Object.assign` are OK.
- **Always commit; don't push until told.** Pushing to `master` auto-deploys via Cloudflare Pages.
- **Bump BOTH** the version string in `updateMemStatus()` (`ui.js`) AND `CACHE` in `sw.js` on every code-changing commit.
- **Three file menus** (`fm-`, `cs-fm-`, `api-fm-`) must stay in sync when adding items.
- Personal save files (`*.json` game exports) are **not committed**.
- **Model string:** confirm `claude-sonnet-4-6` is current before API work.

## Deploy

- **Cloudflare Pages** auto-deploys from `pmegow/traffic-and-dragons` on push to `master` (no build, output = root).
- **Server:** `cd traffic-and-dragons-server && flyctl deploy --ha=false`.
