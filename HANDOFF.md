# Traffic and Dragons — Session Handoff

**Date:** 2026-06-20
**Deployed version:** v1.72 (string in `updateMemStatus()` in `ui.js`)
**Branch:** `master` — clean, all work pushed to `origin` (HEAD `8ebef67`).
**SW cache:** `tnd-v3-20260619j` (`sw.js`).

> Read `CLAUDE.md` first for architecture. This file is just "where we left off."

---

## What shipped this session (v1.59 → v1.72)

| Ver | Commit | What |
|---|---|---|
| 1.59 | a40423c | Mobile topbar wraps File/voice buttons to their own row |
| 1.60 | 03a72a5 | NPC roster: hide dead NPCs + pronoun fallback (known #5/#6) |
| 1.61 | 9a4846c | Native browser TTS fallback + Cartesia error indicator (#20) |
| 1.62 | 5999071 | Append-only transcript (#12), portrait/NPC sync fixes (#2/#3/#4), button long-press/Ctrl-click |
| 1.63 | 8b87ce8 | Mobile topbar: stop HP/gold clipping off the right edge |
| 1.64 | 4db22a6 | Mobile topbar: clear the notch (full `env(safe-area-inset-top)`) |
| 1.65 | 5758701 | **Legacy characters carry full sheet** — gender/relationships/gear (#18, closed) |
| 1.66 | af01f65 | Character Library: read-only inspect sheet |
| 1.67 | f3bb51d | **Unified Import Character + Library** into one modal with Local/Library tabs |
| 1.68 | 87ee9d5 | Import browser: default to Library tab, dim non-hovered rows |
| 1.69 | d045069 | Import browser: auto-fall back to Local when offline |
| 1.70 | 1d02ef1 | Import browser: PC portraits in the Local list (`campPortrait()`) |
| 1.71 | 224d92c | Import browser: Library-first toggle, ☁/⌂ icons |
| 1.72 | 8ebef67 | Import browser: filled-SVG house icon + 65%/non-bold → 100% white/bold row highlight |

**Net result:** the Character Library / Import Character UX is rebuilt and unified.
- `showCharacterBrowser(mode)` is the single entry. `mode` is explicit `"local"`/`"library"`, else defaults to Library when server-connected, Local when offline.
- `showCharLibrary()` is now a thin wrapper → `showCharacterBrowser("library")`.
- `showReadOnlyCharSheet(c, opts)` = new read-only sheet viewer (trimmed copy of `showCharSheet`).
- Rows: avatar + name + sub, click-to-inspect, `.cbr-name`/`.cbr-sub` classes drive the dim/hover states.

---

## ⚠ Still owed: real-device verification (couldn't be done in the desktop preview)

Verified structurally / in a desktop preview only — the preview has no notch, no second device, and a stubbed server. Confirm on the actual phone / connected app:

1. **Mobile topbar (v1.63/64)** — HP/gold no longer clip; name clears the iOS Dynamic Island. `env(safe-area-inset-top)` is 0 on desktop so the notch fix is unverified there.
2. **Cloud portrait propagation (#3, v1.62)** — `portraitVer` reconcile needs a genuine **two-device** round-trip.
3. **Library tab live populate (v1.67+)** — the preview stubbed `storageAdapter.listCharLibrary`; confirm the real server list renders.
4. **Legacy character full-sheet (#18, v1.65)** — only fires when a legacy NPC is rolled (needs server + a Character Library char that isn't the current PC). Force via dev: legacy chance 100.

---

## Open items (from TODO.md — user renumbers often, RE-READ before citing numbers)

**Known issues still open:**
- **#1** Local folder rename `dnd_rpg` → `traffic-and-dragons` — do in Explorer **before** opening Claude Code, then fix paths in `.claude/settings.local.json` + `.claude/hooks/stop-check.js`.
- **#2** Portrait storage bloat — *partial* (per-turn snapshot removed v1.62). **Remaining:** companion portrait stored 2× (`npc.portrait` + `npc.charSheet.portrait`) — deferred (touches swap + export paths).
- **#4** Duplicate NPC entries — *prevention shipped* v1.62. **Remaining:** one-time merge of dupes already in a save (data surgery; the riskiest part).

**Notable backlog (see TODO.md for full list + effort):**
- **#11** Story compiler — `STORY_COMPILER.md` written; now unblocked since #12 transcript exists.
- **Car Mode** — `CAR_MODE.md` written, ready to build (loop-closure of STT→TTS, includes Apple CarPlay audio-only).
- #14 (#17b) structured 3-button suggested-actions model (drop fragile prose-parsing).
- #17 spell/inventory tooltips; #16 sound library; #19/#3 per-character voices.
- Non-Claude providers (Gemini/Grok) shape-verified, still need live money-turn tag-fidelity tests.

---

## Conventions / "don't get burned"

- **ES5 only** — `var`, no arrow/const/let/template-literals. `async/await` only in API-facing funcs.
- **Bump BOTH** the version string in `updateMemStatus()` (`ui.js`) AND `CACHE` in `sw.js` on every code change.
- **Three file menus** (`fm-`, `cs-fm-`, `api-fm-`) must stay in sync.
- **Inline styles beat stylesheet rules** — to override color/weight on hover, move it to a class (why `.cbr-name`/`.cbr-sub` exist).
- Personal save files (`*_t1392*.json`, etc.) are **not committed**.
- Verify previewable changes with the preview MCP tools; verify prompt-construction-only changes with a node render test instead.
- **Model string:** confirm `claude-sonnet-4-6` is current before API work (`PROVIDERS.anthropic` default in `globals.js`).

## Deploy

- **Netlify** auto-deploys from `pmegow/traffic-and-dragons` on push to `master`. Hard-refresh on device after deploy (SW cache bump handles propagation post-v1.28).
- **Server:** `cd traffic-and-dragons-server && flyctl deploy --ha=false`.

---

## Loose ends / judgment calls to revisit

- **Read-only sheet duplication:** `showReadOnlyCharSheet` is a trimmed copy of `showCharSheet` (the live one has portrait-drag/Sync/Export wiring that was risky to generalize). If the sheet layout changes, update both.
- **House icon:** now a filled inline SVG (`currentColor`) to match the filled cloud glyph — user was fine either way; this is the nicer version.
- Context window was ~¼ full at session end; a fresh `/clear` is safe now that everything's pushed.
