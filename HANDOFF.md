# Traffic and Dragons — Session Handoff

**Date:** 2026-06-20
**Deployed version:** v1.80 (string in `updateMemStatus()` in `ui.js`)
**Branch:** `master` — clean, all work pushed to `origin`.
**SW cache:** `tnd-v3-20260620h` (`sw.js`).
**Host:** **Cloudflare Pages** — `traffic-and-dragons.pages.dev` (migrated off Netlify this session).

> Read `CLAUDE.md` first for architecture. This file is just "where we left off."

---

## What shipped this session (v1.73 → v1.80)

| Ver | What |
|---|---|
| 1.73 | **Prose Inspiration** — author-voice picker (Admin menu, all 3 file menus). `AUTHORS` table in `data.js` (10 voices + None); selected voice's directive injected via `proseBlock` in `buildSysPrompt`, read live (switch takes effect next turn); persisted in `PROSE_K`. Also reworded the adult block so **profanity is an explicit unlock** under 18+ (profane voices — Abercrombie, Dinniman, Muir — swear only when 18+ is ON). |
| 1.74 | **Removed the `2-3 sentences maximum` STYLE cap** — it was the run-on root cause (capping count made the model cram everything into one dense sentence). STYLE rule now forbids clause/em-dash/simile cramming and hands length/rhythm to the prose voice. |
| 1.75 | **Companion party-member sheets** — `partyBlock` in `buildSysPrompt` injects each party member's class/level/stats/abilities/**spells available**/inventory. Fixes "a sorcerer companion bonks with a rod" — the GM never saw companion spell lists, only the one-line NPC roster entry. |
| 1.76 | **Native TTS dash→ellipsis** — `_dashToPause()` converts em/en-dash + spaced `--` to `...` on the native path only (browser speechSynthesis swallows dashes; Cartesia + on-screen prose untouched). |
| 1.77 | **Native voice picker** — Voice Settings dropdown from `speechSynthesis.getVoices()` (handles async `voiceschanged`, stored BY NAME in `NVOICE_K`, + Test button). Cross-platform (Windows neural / iOS Enhanced). Zero API cost. |
| 1.78 | Native voice **defaults to "Google US English"** (`_resolveNativeVoice`: saved → preferred default → OS default); dropped "(browser)" wording → "Use native voice" / "Native voice". |
| 1.79 | **SW cache-first** (was network-first) — the bandwidth fix. Network-first re-downloaded the whole app shell every load → blew past Netlify's 100 GB/mo cap → site paused. Cache-first serves the shell from Cache Storage between deploys; safe because `CACHE` is bumped every deploy + browsers fetch sw.js fresh per navigation. |
| 1.80 | **Cloudflare Pages migration** — pure-static, no build, output dir = repo root. Added `_headers` (force sw.js/app-shell no-cache so deploys are always detected). Verified live: ui.js=v1.80, sw.js cache=…h, cache-first, headers applied. |

**Net result:** new prose-voice system + the run-on fix, companions use their full kit, better/cheaper TTS, and hosting moved to unlimited-bandwidth Cloudflare Pages.

---

## ⚠ Still owed: real-device / live verification

1. **Prose voices in real play** — code is done; the *directive tuning* (#23) wants your ear. A/B opposite voices (Cook vs Muir) on the same scene; confirm profane three swear with 18+ on, clean with it off; confirm the run-ons are actually gone.
2. **Native voice** — confirm "Google US English" (or your pick) sounds right on the real device; iOS needs Enhanced voices downloaded (Settings ▸ Accessibility ▸ Spoken Content ▸ Voices), and iOS Web Speech is flaky — real-device test.
3. **Companion casting** — drop into a fight with a spellcaster companion; confirm they now cast from their list instead of swinging a weapon.
4. **Cloudflare origin** — confirmed live this session (login + sync work from `*.pages.dev`). Remaining housekeeping: update all devices to the new URL; optionally disconnect the (paused) Netlify site so pushes stop poking a dead deploy.
5. Carried over from last session: mobile topbar notch (v1.63/64), 2-device portrait propagation (#3), Library tab live-populate, legacy character full-sheet (#18) — all need real devices/server.

---

## Open items (from TODO.md — RE-READ before citing numbers; user renumbers)

- **#23 Prose Inspiration** — shipped; open part is author/directive *tuning* from real-play feedback.
- **#24 Token economy / brevity** — the deliberate replacement for the removed sentence cap. Brevity cuts BOTH LLM tokens AND Cartesia's per-character TTS bill. Options: per-voice length character, or an explicit Brevity dial (terse/normal/lavish). Load-bearing under the subscription cost model.
- **Car Mode** (`CAR_MODE.md`) — unblocked; Phase 1 = `TTS._drain()` onComplete → `STT.start()` → auto-send.
- **Story Compiler** (`STORY_COMPILER.md`) — unblocked (#12 transcript exists); weave from verbatim transcript prose.
- **Server architecture** — when going live: evolve the existing Fly server into the subscription API gateway (NOT AWS). Next step is to draft `SERVER_ARCHITECTURE.md` from the existing server's code. Tabled by user.
- Known issues still open: #1 folder rename, #2 companion-portrait 2× dedup, #4 one-time NPC-dupe merge in saves.

---

## Conventions / "don't get burned"

- **ES5 only** — `var`, no arrow/const/let/template-literals. `async/await` only in API-facing funcs.
- **Always commit; don't push until told.** Pushing to `master` auto-deploys (now Cloudflare). User tests locally (open `dnd_game_1_0.html` or local preview). Batch commits, push on explicit go. (Migration was the exception — Cloudflare needed the code on GitHub.)
- **Bump BOTH** the version string in `updateMemStatus()` (`ui.js`) AND `CACHE` in `sw.js` on every code-changing commit.
- **Three file menus** (`fm-`, `cs-fm-`, `api-fm-`) must stay in sync.
- Personal save files (`*_t1392*.json`) are **not committed**.
- Verify previewable changes with the preview MCP; verify prompt-construction-only changes by inspection / a synthetic `buildSysPrompt` call (no preview).
- **Model string:** confirm `claude-sonnet-4-6` is current before API work (`PROVIDERS.anthropic` default in `globals.js`).

## Deploy

- **Cloudflare Pages** auto-deploys from `pmegow/traffic-and-dragons` on push to `master` (no build, output = root). Unlimited bandwidth. `_headers` keeps sw.js/shell fresh; hard-refresh on device after deploy.
- **Server:** `cd traffic-and-dragons-server && flyctl deploy --ha=false`.

---

## Loose ends / judgment calls

- **"system default" native voice** now resolves to Google US English (the preferred default), not the bare OS voice. Intentional; make it a true escape hatch if the user ever wants pure-OS default.
- **Cartesia 402** seen in the wild = character quota exhausted; the v1.61 native-voice fallback worked perfectly — no fix needed.
- `_headers` returns `Cache-Control: no-cache, no-cache` (Cloudflare default + our file both set it) — harmless duplicate.
