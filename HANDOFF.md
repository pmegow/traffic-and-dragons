# Traffic and Dragons — Session Handoff

**Date:** 2026-06-30
**Deployed version:** v1.137 (`APP_VERSION` in `globals.js`) — **v1.140 committed locally, NOT deployed** (nothing pushed this session).
**SW cache:** `tnd-v3-20260630c` (`sw.js`, local — deployed site is still on the pre-session cache tag).
**Branch:** `master` — **8 commits ahead of `origin/master`, none pushed.** In order: the 4 Blueprint
Designer doc commits from last session (`11c6c35`…`f16fe2b`), then this session's 4 code commits
(`146bc47` v1.138 → `7b258f1` v1.139 → `d0afe8a` v1.140 → `dbe4633` playtest harness).
**Host:** **Cloudflare Pages** — `traffic-and-dragons.pages.dev` (auto-deploys on push to `master`).

> Read `CLAUDE.md` first for architecture. This file is just "where we left off."
> The next real feature is still the **Blueprint Designer** — spec is fully locked in
> `BLUEPRINT_EDITOR.md`. Nothing built on it yet; this session was all bug-driven.

---

## This session: three real bugs fixed, plus a reusable playtest harness

Short session, all reactive — the user reported three concrete bugs from actual play (car Bluetooth,
an unreachable mobile close button, a stuck combat panel), each fixed and verified live in the
`preview_*` tools, then closed with a new dev tool for automated regression testing.

| Ver | What | Files |
|---|---|---|
| 1.138 | **Silent native TTS over car Bluetooth (iOS Safari).** Root cause: `speechSynthesis` alone doesn't claim iOS's "playback" audio session category — without an active `AudioContext`, page audio defaults to "ambient," which can route nowhere over Bluetooth and gets silenced by the mute switch. Car Mode never created an `AudioContext` for native-only voice. Fix: `TTS.primeAudioSession()` starts a silent looping `AudioContext` buffer the instant Car Mode is entered (inside the tap gesture, as iOS requires), torn down on exit via `stopAudioSessionPrimer()`. **Not yet road-tested on a real iPhone** — logic verified, audio routing itself can't be confirmed in a browser preview. | `tts.js`, `ui.js`, `globals.js`, `sw.js` |
| 1.139 | **World State sidebar close button unreachable on mobile.** The `×` was `position:absolute;top:14px;right:14px` pinned to the sidebar's raw top-right corner, landing near/under the phone status bar. Moved into a normal-flow header row (title + `×`, flex space-between) matching every other modal in the app (`.sb-head` class added). Verified in the mobile preview (click closed it cleanly). | `index.html` |
| 1.140 | **Dead enemies never leaving the combat panel.** `worldState.combat` was only ever cleared by an explicit `[COMBAT_END:]` tag from the GM. If the GM narrated a kill (or an enemy bled out over several turns) without emitting that tag, the corpse stayed in the panel for the rest of the session — reported as "a goblin was left to bleed to death and hung out there indefinitely." Fix: `applyMuts` now auto-clears combat as soon as HP hits 0, unless the same response already closed it explicitly (that path untouched). Verified directly against `applyMuts` in the preview: both the missing-tag case and the explicit-tag case clear correctly. **No retroactive cleanup for already-stuck saves** — user explicitly said not worth building; only new kills benefit. | `api.js`, `globals.js`, `sw.js` |
| — | **Automated playtest harness** (`dev/playtest-harness.js`, new file, not loaded by `index.html`). Drives N real GM turns against a throwaway character via `preview_eval` — builds a character directly through `startGame()` (skips the 7-step wizard entirely), then loops: wait idle → pick a random live suggested action → `sendAction()` → wait idle → log narration + invariants (hp/gold/xp/combat/sessionTokens). Runs in small batches (5–10 turns) since `preview_eval` has a ~30s tool-side timeout, but the page keeps executing the async batch in the background regardless — just re-poll `window.__pt.log.length`, no progress is lost. Full usage instructions are in the file header, also pointed to from `CLAUDE.md`'s Dev workflow section. | `dev/playtest-harness.js` (new), `CLAUDE.md` |

**Live-fire test of the harness:** ran 50 turns against a fresh throwaway character
("Kettren Voss," Warrior, gritty tone, Abercrombie prose author) to sanity-check both halves:
- **Invariants:** zero errors across 50 turns. Combat (turns 29–31, Blight Crawler) cleared the
  panel correctly the turn it ended — confirms the v1.140 fix under real play. `sessionTokens`
  cycled down every ~4–5 turns (summarization firing on schedule throughout, not just once).
  HP/gold/XP all stayed sane.
- **Prose/content-DNA drift (the harder half — this is what the user actually wanted a fast way
  to check):** compared sampled turns 1–3 against 48–50. Sentence austerity and fragment discipline
  **held or tightened** by the end rather than degrading (turn 49: `"'Could have broken it,' you
  say. 'Didn't.'"`). Content DNA (institutional corruption, no clean allies, protagonist complicit
  in his own setup) also tracked all the way through. **Verdict: Remedy A (v1.137, the skeleton
  `dnaHint` work) is doing its job** — no sign of the "ledger" collapse from the prior session's
  diagnosis, at least on a fresh campaign. This was the best-case test (fresh skeleton, has
  `dnaHint`s); an old pre-v1.137 save is still expected to lack the benefit per last session's note.
- One soft spot, not a bug: combat/monster-description turns ran longer, more clause-heavy
  sentences than dialogue scenes (concrete detail, not lyrical, but a genre pull worth knowing about).

---

## How to invoke the playtest harness next time

Tell me two things: **(1) which campaign** — fresh throwaway (pick an author/tone, or let me choose)
vs. an existing save (e.g. to A/B an old pre-v1.137 campaign for drift), and **(2) how many turns**.
Example: *"Run the playtest harness for 30 turns on a fresh Le Guin campaign, tell me if the voice
holds."* I'll confirm the API-key-in-preview step and cost before actually running it, same as this
session. Full mechanics are documented in `dev/playtest-harness.js`'s file header.

---

## Drift work — still the state from last session (untouched this session)

- ✅ **Content drift** (the ledger) — addressed by Remedy A (v1.137). **Reinforced by tonight's
  50-turn test**, which is the first real evidence the fix works end-to-end.
- ⚠️ **Voice erosion from sessionLog momentum ("Remedy B")** — still NOT built. Tonight's test
  didn't contradict this being needed eventually (the run was only 50 turns / a handful of
  summarization cycles), but didn't surface an urgent case for it either. Do NOT propose injecting
  synthetic messages into `sessionLog` — user explicitly rejected that approach previously.
- ⚠️ **Existing saves don't benefit from Remedy A** — still true, still untested this session
  (tonight's harness run used a fresh campaign, the best case). **Good next use of the harness:**
  run it against the actual old Runelords/Ammut save and see whether drift is visible there,
  now that there's a fast way to check instead of playing 50 turns by hand.

---

## Next feature: Blueprint Designer (spec locked, nothing built — unchanged from last session)

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
| 2 (Car Mode) | v1.138 fixed the silent-audio bug found in real testing. Still needs a full real-device road test beyond just the audio-routing fix. |
| 5 (Campaign Designer) | **ABSORBED** into the Blueprint Designer (Generate mode). |
| 25 (new) | Merge Ancestry into Identity step — pending. |
| 26 (new) | Augment Deep Dwarf darkvision — pending (scope TBD). |
| 27 (new) | Add camouflage to Gnome racial benefits — pending. |
| Known issue #4 | **"New Game" drops user on the OLD campaign's Review (step 7)** instead of step 1. Not investigated. |
| (new) | World State sidebar close button — **fixed, v1.139.** |
| (new) | Combat panel not clearing on kill without explicit tag — **fixed, v1.140.** |

---

## Pending / known "don't get burned"

- **Push all 8 pending commits** if you want them live (nothing this session was pushed; user
  tests locally first per the standing workflow).
- **`AUDIT_RESULTS.html` shows as staged-deleted** in `git status` — pre-existing, unrelated.
- **`TODO.md` has an uncommitted local modification** (not from this session — was already
  modified when this session started; not investigated or touched).
- **v1.138 (car Bluetooth fix) needs a real iPhone + car test** before considering it fully done —
  the logic and audio-session priming were verified, but actual Bluetooth audio routing can't be
  confirmed in a browser preview.
- `parseActions()` in `api.js` is legacy-only (pre-v1.110 save replay). Harmless.
- Service worker is **cache-first** — bump `CACHE` in `sw.js` every code commit (done this session,
  three times, once per code-changing commit).
- **Preview gotcha, reinforced this session:** the preview browser's `localStorage` persists across
  `preview_start`/`preview_stop` cycles within a conversation (same origin, same profile) — clear
  stale `tnd_*` keys and reload before trusting `worldState`/screen visibility, especially after
  ad-hoc `preview_eval` testing left junk state behind (happened this session, had to clean it up
  before the playtest run).

---

## Conventions

- **ES5.1+** — `var`, no arrow/const/let/template-literals. `async/await` only in the API-facing
  functions. ES5.1 builtins + `Object.assign` are OK. **Enforced by a pre-write hook**
  (`.claude/hooks/es5-check.js`) — it's a naive regex check and will flag arrow syntax even inside
  comments (hit this tonight writing `dev/playtest-harness.js`'s docstring).
- **Always commit; don't push until told.** Pushing to `master` auto-deploys via Cloudflare Pages
  (the user tests locally first to save deploy cycles).
- **Bump BOTH** `APP_VERSION` (`globals.js`) AND `CACHE` (`sw.js`) on every code-changing commit.
  Dev-only files not loaded by `index.html` (like `dev/playtest-harness.js`) don't need a bump.
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
