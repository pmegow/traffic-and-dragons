# Traffic and Dragons — Session Handoff

**Date:** 2026-07-03
**Deployed version:** v1.152 (`APP_VERSION` in `globals.js`) — **live on Cloudflare Pages, verified.**
**SW cache:** `tnd-v3-20260703b` (`sw.js`).
**Branch:** `master` — **pushed through `d6e01fa`** (`origin/master` == local HEAD). All game code live.
**Server:** healthy on Fly (`traffic-and-dragons-server.fly.dev`), restored from snapshot after a host death — see below.

> **STANDING RULE: every commit is gated on the engine test suite.** `.git/hooks/pre-commit`
> runs `dev/run-tests.js` (**now 72 assertions**, headless node, ~1s) and BLOCKS on red. Suites live
> in `dev/engine-tests.js`, shared with the browser view `test.html`. Add regression tests there when
> touching api.js/memory.js/game.js/**storage-adapter.js**. Hook isn't tracked — after a fresh clone:
> `cp dev/pre-commit .git/hooks/pre-commit`. `--no-verify` = emergencies only.
> **Host:** Cloudflare Pages ONLY (`traffic-and-dragons.pages.dev`). GitHub Pages stays disabled.

> Read `CLAUDE.md` first for architecture. This file is just "where we left off."
> This session: **usage telemetry (v1.150)**, **prompt caching (v1.151, measured −29% turn cost)**,
> a **dead-Fly-host incident + full recovery** (zero turns lost), **sync hardening (v1.152)**, a
> **server health monitor**, the **audit playbook**, and todo-viewer polish.
> The next real feature is still the **Blueprint Designer** (`BLUEPRINT_EDITOR.md`, decision-locked).

---

## ⚠️ Uncommitted working-tree state (user edits — DO NOT blindly commit/revert)

At handoff the working tree has changes the **user** made outside the commit stream:
- **`TODO.md` modified** — user added 3 new backlog rows via the viewer: *beta-tester setup wizard*,
  *add Anne Rice to prose inspirations*, *discuss a RAG-based memory system*. **Side effect to know:**
  the viewer's export clobbered **#25's status back to "Pending"** even though #25 is DONE + deployed +
  monitor-live (classic todo-viewer stale-load-then-export overwrite). If you re-save TODO from the
  viewer, re-mark #25 Done, or the truth lives here and in commit `d6e01fa`.
- **`AUDIT_FABLE.md` moved** → `audits/AUDIT_FABLE_07_01_26.md` (user archived it; the audit is closed).
- **`AUDIT_RESULTS.html` deleted** (pre-existing stale artifact).
- **`Rise_of_the_Runelords__Ammut__Ammut_t54.tnd`** still untracked in repo root — **personal save,
  do NOT commit.** It's the harness fixture for the caching A/B; leave it.

None of this is broken — just don't `git add -A` and sweep it into a code commit.

---

## This session's work (all committed + pushed)

| Ver | What | Files |
|---|---|---|
| 1.150 | **Usage/cost telemetry (TODO #21).** Every provider adapter gained `parseUsage()`; `callGM` records API-reported tokens onto `worldState.usage` via `recordUsage()` — totals + per-kind buckets (turn/actions/summarize/skeleton/sync/other) + `costUSD` priced from `MODEL_PRICING` (globals.js, 2026-07 Anthropic rates, cache write 1.25× / read 0.1×). Dev Mode ▸ 📊 Usage & cost… modal (all 3 File menus): per-kind table, In/call averages, Reset for measurement windows. `blankUsage()` in state.js; `migrateWorldState` back-fills old saves. | globals.js, state.js, api.js, ui.js, game.js, memory.js, index.html |
| 1.151 | **Prompt caching (TODO #11) — closes AUDIT_FABLE #20.** `buildSysPrompt` now returns `{stable, volatile}`: campaign-constant text (rules/role/tone/DNA/**full STATE TAGS block**, ~4,889 tok) first, all per-turn state after, **STYLE kept at the very END** (voice fidelity). `PROVIDERS.anthropic.buildBody` sends a two-block `system` array with `cache_control:{type:"ephemeral"}` on the stable block; other adapters flatten via `sysJoin()`; `sysOverride` strings untouched. Engine test enforces the **byte-identical-stable invariant**. | api.js, globals.js, dev/engine-tests.js, CLAUDE.md, AUDIT_FABLE.md |
| 1.152 | **Sync hardening (TODO #24).** `_tFetch` (AbortController, 20s) wraps the state POST / portrait PUT / campaign-list GET so a hung request can never wedge `_syncing` again. `syncStatus()` tracks `_lastAckTurn` + consecutive failures; `updateSyncBadge()` (ui.js) shows a **red ☁ "N turns unsynced" / "sync failing"** membar badge; toast at 3 consecutive fails; dedicated **"session expired — reconnect"** on 401. Auto-retry on `online` + app-foreground. `load()` seeds the ACK baseline so an ahead-of-server device shows the gap immediately. storage-adapter.js now loads in the headless suite. | storage-adapter.js, ui.js, globals.js, sw.js, dev/run-tests.js, dev/engine-tests.js |
| — | **Server health monitor (TODO #25).** `/health` on the Fly server now does a **SQLite read** (corrupt/missing volume → 500, not a lying 200) — deployed + verified. `.github/workflows/server-health.yml`: cron every 15 min, 3 attempts (absorbs Fly cold-start wake), failed run → GitHub emails the workflow author. **Manual run confirmed green.** | traffic-and-dragons-server/index.js (deployed via flyctl), .github/workflows/server-health.yml |
| — | **AUDIT_PLAYBOOK.md** — the audit PROCESS captured while fresh (find-then-fix phases, finding format, done-requires-evidence, confidence-review-at-the-end, next-audit scope, ~40-version cadence). Docs. | AUDIT_PLAYBOOK.md |
| — | **todo-viewer polish** — "Select TODO" button (unstick the sticky IndexedDB autoload), current-file name line, per-section Add task / Add issue buttons, Export button labels the loaded file. Dev-only page (no version bump). | todo-viewer.html |

### Measured caching result (the headline number)
12-turn harness A/B on the **Runelords t54 save**, Sonnet 4.6, identical fresh copies:
- Stable block = **4,889 tok**; total prompt/turn unchanged (clean A/B).
- **11/11 cache hits** after the turn-1 cold write (reads = exactly 11 × 4,889).
- Turn-bucket cost **$0.506 → $0.359 (−28.9%)**; input cost/turn **−32.3%**; all-in batch **−24.9%**.
- Prose voice spot-checked, held. ≈**3–3.75¢/turn** all-in on a mature save (~$0.75–1.10/player-hour ceiling).
- Caveat: 5-min cache TTL — idling >5 min between turns pays one re-write (~0.4¢), negligible.

**AUDIT_FABLE is fully CLOSED** (28/30 done+validated). The two open rows are open BY DESIGN:
**#24** (dead `#tone-grid` selector) rides the Blueprint Designer §5.2; **#29** (`parseActions` legacy
tiers) waits for pre-v1.110 saves to age out. #22 (blankNpc factory) was a considered won't-fix.

---

## The dead-host incident (2026-07-03) — resolved, but leaves tails

A Fly **host died**, taking the machine AND its data volume. Symptoms: every request hung with no
error; the phone silently accumulated ~20 unsynced turns showing "Connected"; desktop's campaign
picker flashed "Waking server up" forever. **Recovery performed:** new volume from the 10-hour-old
snapshot → destroyed the stranded machine → `flyctl deploy --ha=false` (needed 2 retries: one raced
the destroy, one grabbed the dead volume). Devices re-synced with **zero lost turns** (local is
source of truth). This incident is what spawned #24/#25 (both now done) and #26 (below).

**Tails still open:**
- **Dead volume `vol_r7yw0lnl3lejpm1r` (host f0d2) can't be destroyed** while its host is down
  (Fly API 408s). Retry `flyctl volumes destroy vol_r7yw0lnl3lejpm1r --yes` in a few days, or open
  a Fly support ticket if it lingers. Harmless meanwhile (ghost-attached to the destroyed machine).
- **TODO #26 (restore runbook) NOT written yet** — the recovery steps live only in the TODO cell.
  Codify as `dev/restore-server.md` next server-touch session.

---

## Next session, in order of value

1. **Blueprint Designer** (`BLUEPRINT_EDITOR.md`, decision-locked) — the next real feature. Build order:
   §5.1 load-time normalizer first; §5.2 dead `#tone-grid .card` selector (closes AUDIT_FABLE #24);
   §5.3 Runelords fixture invalid `"tone":"high_fantasy"`; §5.5 `buildBlueprintFromGame` lossy `knowledge[0]`.
   **#22 (content sanitization) is a HARD GATE before its cloud/public-sharing half ever ships.**
2. **New user backlog items** (added via viewer this session): beta-tester setup wizard; add **Anne Rice**
   to `AUTHORS` prose voices (data.js — pattern: `{id, nm, blurb, vc, profane?, contentDNA?}`); discuss a
   **RAG-based memory system** (design conversation, not a build yet).
3. **TODO #26** restore-runbook doc (small); **destroy the dead Fly volume** once its host recovers.
4. **Baseline is banked** — the caching win is measured, not estimated. Real-play usage now accrues in
   the 📊 modal, so a longer corpus is free.

---

## Open threads / "don't get burned"

- **Prompt-caching invariant is load-bearing:** anything reading `worldState`/`memory`/`sessionLog` must
  NEVER leak into `buildSysPrompt`'s **stable** half — one stray per-turn value kills every cache hit.
  The engine test `stable half is byte-identical…` guards it; keep it green. Switching prose voice / rules
  / adult-mode is fine — it re-writes the cache once, then warms again (expected).
- **Sync failure is now VISIBLE** (red ☁ badge, toasts) and self-heals in 20s — but the underlying
  **last-writer-wins model is unchanged** (Known issue #5). A stale device playing a turn still rolls the
  server back. The real fix is the server-authoritative turn guard; #24 only made the failure detectable.
- **Health monitor is armed** — if the server dies, you get a GitHub email within ~15 min. Confirm your
  GitHub notification settings have **Actions failure emails ON** (checked once, but verify on your side).
- **Runelords save** in repo root — personal, do NOT commit. **`audits/` + AUDIT file move** are the
  user's housekeeping; leave as-is.
- **Car Mode still needs a real-device pass** (Bluetooth priming, notch clearance). TODO #2/#19.

---

## Standing gotchas reconfirmed this session

- **SW is cache-first — bump `CACHE` in `sw.js` on EVERY code-changing commit** (and `APP_VERSION` in
  globals.js). In-preview stale-cache fix: unregister SW + clear caches + reload via `preview_eval`.
  Dev pages (todo-viewer.html) get cached too — clear when one looks stale.
- **Port 3000 orphans:** `npx serve` processes outlived their preview servers twice this session and
  blocked `preview_start`. Fix: `Stop-Process -Id <pid> -Force`, then restart. (Port 3000 is worth
  keeping so the preview's localStorage/API key survive.)
- **Preview came up on the API-key screen with empty storage** after a fresh `preview_start` — the key
  entered in a prior preview window doesn't carry. Ask the user to type it into the visible key screen;
  never paste a real key into `preview_eval`.
- **`preview_eval` can time out (30s) on multi-step chains** even when the page is responsive — split into
  smaller evals (fetch-into-window-global, then process) rather than one big async block.
- **Model:** `MDL` in globals.js is `claude-sonnet-4-6` (game default) — confirm current before API work.
  `MODEL_PRICING` (globals.js) rates were verified 2026-07-02; re-verify if Anthropic pricing shifts.
- **ES5 only** (`var`, no arrow/const/let/template-literals; `async/await` only in the API-facing fns).
  Pre-write hook `.claude/hooks/es5-check.js` enforces it.
- **Three file menus** (`fm-`/`cs-fm-`/`api-fm-`) must stay in sync when adding items.
- **Always commit; don't push until told.** Bump `APP_VERSION` + `CACHE` on every game-code commit;
  dev-only files (test.html, todo-viewer.html, dev/*, .github/*) don't need a bump.

## Playtest harness (the caching A/B tool)

`dev/playtest-harness.js` (not loaded by index.html) drives N real GM turns via `preview_eval`. This
session it ran the before/after caching measurement: import a `.tnd` save into preview localStorage,
Reset the usage counters, run `__ptRunBatch(N)`, read `worldState.usage`. Re-run with the SAME save +
turn count for any future perf A/B. To invoke: tell me the campaign (fresh throwaway or a `.tnd` save)
and the turn count. Full mechanics in the file header.

## Deploy

- **Cloudflare Pages** auto-deploys from `pmegow/traffic-and-dragons` on push to `master` (no build,
  output = repo root). Poll `globals.js?nc=<ts>` for the live `APP_VERSION` to confirm.
- **Server:** `cd traffic-and-dragons-server && flyctl deploy --ha=false`. It is a **separate,
  UNtracked repo** (no git) — deploy by flyctl, no push. `/health` is monitored by the Actions cron.
