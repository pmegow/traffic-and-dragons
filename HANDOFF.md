# Traffic and Dragons — Session Handoff

**Date:** 2026-07-01
**Deployed version:** v1.143 (`APP_VERSION` in `globals.js`).
**SW cache:** `tnd-v3-20260701b` (`sw.js`).
**Branch:** `master` — **fully pushed. `origin/master` == local == `1c3bdd2`.** Everything this session
is live (Cloudflare Pages auto-deploys on push).
**Host:** **Cloudflare Pages** — `traffic-and-dragons.pages.dev`.

> Read `CLAUDE.md` first for architecture. This file is just "where we left off."
> The next real feature is still the **Blueprint Designer** — spec fully locked in
> `BLUEPRINT_EDITOR.md`. Nothing built on it yet; this session was Car Mode polish, a wizard
> merge, an audit-driven bug batch, and TODO tooling.

---

## This session's work (all committed + pushed)

| Ver | What | Files |
|---|---|---|
| 1.141 | **Car Mode UI overhaul (from a hand sketch).** Notch-safe top padding (matches the main mobile UI's `env(safe-area-inset-top)`), portrait doubled to `min(360px,60vw)` at 3:4, party HP bubbles moved directly under the portrait, and **on-screen prev/play/next transport buttons** added (previously the only way to skip/replay was the car stereo's media-session buttons or desktop arrow keys — unusable on a phone). Buttons **pulse** on trigger from any source (touch/keyboard/media session). Iterated: name size doubled then reverted (long names wrapped ugly), keyboard-hint row removed, and the prev/next **Unicode glyphs swapped for inline SVG** because ⏮/⏭ have asymmetric side-bearing and sat visibly off-center. | `index.html`, `ui.js`, `globals.js`, `sw.js` |
| 1.142 | **Merged Ancestry into Identity (TODO #25).** Wizard is now **6 steps, not 7** — gender/age selects sit directly above the ancestry grid/detail picker in one "Identity" step. Single Back/Next pair (`id-back`/`anc-next`); `anc-next` validates ancestry+subrace+lineage+flex-stat picks. All downstream steps (Class/Attributes/Finishing Touches/Review) renumbered; every `goStep()` call site, `s#-warn` id, and `buildDots()` total updated. CLAUDE.md wizard table corrected (it had also drifted from two earlier changes). | `index.html`, `char-creation.js`, `ui.js`, `CLAUDE.md`, `globals.js`, `sw.js` |
| 1.143 | **Four fixes found auditing a real played save** (`Rise_of_the_Runelords__Ammut__Ammut_t54.tnd`, 54 turns — see below). | `memory.js`, `data.js`, `globals.js`, `sw.js` |
| — | **TODO housekeeping + viewer collapse features** (no version bump — `TODO.md` is data, `todo-viewer.html` is a dev tool not loaded by `index.html`). Removed the stale "v1.50 audit" note; moved "Clear for Release" to the bottom. In `todo-viewer.html`: every `##` section is now collapsible, AND every task item collapses to a one-line headline (lead up to first em/en-dash, else first sentence; status hidden while collapsed). Everything defaults collapsed. Render-only — Export/`buildMd` unaffected, transient `_expanded` flag never leaks to disk. | `TODO.md`, `todo-viewer.html` |

### The audit (v1.143) — how it was done + what shipped
The user exported a 54-turn save; I read `worldState.transcript` + `memory.npcs` via `node` and found four issues:
1. **NPC identity fragmentation → CODE fix** (`resolveNpcName` in `memory.js`). One person forking into
   several `memory.npcs` entries ("Morwen"/"Morwen Zethran"/"Morwen (Ammut's wife)"; "Hemlock"/"Sheriff
   Belor Hemlock"; "Bruthazmus (Bugbear Captain)"). Rewrote resolution to match **distinctive tokens**
   (parentheticals + honorifics/generic role nouns stripped) as a subset **either direction**, guarded by
   a **single-candidate check** so distinct people sharing a token (Kaijitsu siblings) never wrongly merge.
   Chosen over a prompt rule because the existing NPC-naming rule was followed **0/54 turns**. Validated
   against the save: 29 variants → 18 correct entries, both name orderings, siblings kept separate.
   **This is the only airtight fix (engine code).**
2. **Active crises never logged as quests** (rule, `data.js`) — opening goblin siege etc. never got a
   `[QUEST:]`. New rule: a danger the player is already fighting IS an active quest.
3. **Player-declared spells granted without a sheet check** (rule, `data.js`) — GM let Ammut cast Detect
   Magic (not on his sheet) just because the player typed it. New rule: player actions are intent, verify
   against the sheet.
4. **Future-event queue leak** (rule, `data.js`) — 30 `[FUTURE_EVENT:]` planted, 0 ever resolved. New rule
   to emit `[FUTURE_EVENT_RESOLVED:]`.

**Caveat carried forward:** fixes 2–4 are **prompt-only → improve the odds, not guaranteed.** Existing saves
keep already-forked NPC entries (fix 1 prevents new forking, no retroactive merge — same scoping as the
v1.140 combat fix). **Best next use of the playtest harness:** a fresh run watching specifically for
quest-tag firing on the opening crisis and future-event resolution.

---

## Open threads / "don't get burned"

- **Blueprint Designer is still the next real feature.** `BLUEPRINT_EDITOR.md` is a complete, decision-locked
  spec. Nothing built. Build order: §5.1 load-time normalizer first. Known bugs to fix in the same surface:
  §5.2 `_applyBlueprint()` (`ui.js`) still targets the dead `#tone-grid .card` (broken since the v1.133
  dropdown swap); §5.3 shipped Runelords fixture has invalid `"tone":"high_fantasy"` (valid: `high`);
  §5.5 `buildBlueprintFromGame` only captures `knowledge[0]` (lossy). Reference: `rise_of_the_runelords.blueprint`.
- **Spawned background task (not done):** "Fix duplicated subrace+ancestry name on Review step" —
  `char-creation.js` `buildReview()` ~line 197 concatenates `getSubNm()` + `anc.nm`, producing "Wood Elf
  Elf Warrior" / "Drow Elf Warrior". Cosmetic. Fix: don't append `anc.nm` when a subrace name is present.
- **Car Mode still needs a real-device pass:** (a) v1.138 Bluetooth audio-session priming was never
  road-tested on a real iPhone; (b) the new v1.141 UI's **notch clearance couldn't be confirmed in the
  browser emulator** (no physical notch) — worth a phone glance. TODO #2 tracks the broader real-device test.
- **Runelords save file** `Rise_of_the_Runelords__Ammut__Ammut_t54.tnd` sits **untracked** in the repo root —
  personal save, do NOT commit (matches the "game exports not committed" convention). Fine to delete if it's
  in the way.
- **`AUDIT_RESULTS.html` shows staged-deleted** and **`TODO.md` has a trivial 1-line uncommitted change**
  (a trailing-newline artifact from the viewer's Export) — both pre-existing/benign, left untouched.

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
