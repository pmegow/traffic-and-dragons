# AGENTS.md — ground rules for external agents (Sol / Codex)

This file is the entry point for non-Claude engineering agents working in this repo.
It deliberately contains NO architecture documentation — the earlier version of this file was a
snapshot copy of the project reference and had rotted 14 files out of date by the time it was
replaced (2026-08-03). The rule now:

> **[CLAUDE.md](CLAUDE.md) is the single authoritative project reference** — architecture, file
> map, load order, schemas, systems, conventions, dev workflow. Read it before touching
> anything, and read it THERE, never from a copy. (Its instructions addressed to "Claude"
> sessions about tier policy apply to you as the boundary rules below.) Open work lives only in
> [TODO.md](TODO.md). Your current assignments live in [DOC/todos_completed/SOL_TASKS.md](DOC/todos_completed/SOL_TASKS.md).

## Hard boundaries — the drift-protection surface (READ-ONLY for you)

This project's core value is its anti-drift stack (state tags → parser → memory tiers → prompt
injection), and that stack's failure modes are SILENT: degraded canon, a dead prompt cache,
fused NPCs. By standing owner decree (2026-07-09), changes to it go through a specific reviewed
workflow that external agents are not part of. **Read these files freely; never edit them:**

- `tag_table.js` — THE tag parser, strip registry, byte-frozen STATE TAGS prompt docs
- `api.js` — prompt construction (stable/volatile cache split), engine-note builders
- `memory.js` — summarization, RAG retrieval, alias/merge resolution, every memory tier
- `data.js` — game data + `DEFAULT_RULES` (prompt-injected)
- `clock.js` · `table-talk.js` · `campaign_generator.js` — scheduler, help-agent isolation, skeleton prompts
- `capability_bible.js` · `class_bible.js` — content canon; their file FORMATS are contract-pinned by tests

**Ask-first files** — possible to edit, but get explicit owner sign-off before starting:
`state.js`, `game.js`, `storage-adapter.js`, `index.html`, and `globals.js`/`sw.js` beyond the
version-marker bumps described below. Everything else (`ui-*.js`, `tts.js`, `stt.js`, satellite
`.html` tools, `dev/` tooling, `DOC/`) is normal working territory when a task brief covers it.

If a task turns out to require touching a read-only file, **stop and report** — do not work
around the boundary by duplicating its logic somewhere else.

## Non-negotiable conventions

1. **ES5.1 JavaScript only** in game files: `var`, no arrow functions, no template literals, no
   `const`/`let`/classes. (`async/await` exists only in the API-facing functions.) A repo hook
   enforces this. `dev/` node scripts may use modern JS.
2. **No dependencies, no build step.** The game must keep running from `file://` and Cloudflare
   Pages exactly as-is.
3. **Test gate:** `node dev/run-tests.js` must end `ALL GREEN` before every commit — the tracked
   pre-commit hook runs it; never bypass with `--no-verify`. For logic changes, write the
   failing test FIRST (in `dev/engine-tests.js`), then implement to green. Exercise the FAILURE
   condition, not a benign case.
4. **Version markers:** every commit that changes game code bumps `APP_VERSION` (globals.js)
   AND `CACHE` (sw.js) in that same commit. Docs-only or `dev/`-tooling-only commits don't.
5. **TODO.md is the source of truth:** update your task's row (its Status cell) in the same
   commit as the fix. Don't restructure the table — one row per task, pipes intact
   (`dev/lint-todo.js` gates commits).
6. **Tight, single-concern commits** whose messages explain the WHY — a bug fix names its root
   cause, not just the change.
7. **Stage explicit files only — NEVER `git add -A` / `git add .`** Multiple agents share this
   working tree concurrently; a sweep commit swallows someone else's work in progress.
8. **Push after each completed task.**
9. **No silent failures.** A caught error that surfaces nothing is itself a bug: `console.warn`
   at minimum, a `showToast(...)` for player-visible conditions, and always include the reason.
10. **Comments state constraints the code can't show.** Never narrate what the next line does,
    and never reference the change process itself ("fixed", "new", "now correctly").
11. **UI style:** no pill/chip borders on non-interactive elements; amber `--acc` identity;
    modals created fresh (remove prior instance by id). See CLAUDE.md ▸ Conventions.

## Verification norms

- Engine logic → headless suite (`node dev/run-tests.js`).
- Visual/layout work → the rendered result is ground truth: screenshot the broken case before
  and the fixed case after. Hard-refresh (`Ctrl+Shift+R`) — the service worker caches
  aggressively; File ▸ Clear cache & reload is the manual escape hatch.
- Report outcomes faithfully: a failed test is reported with its output; a skipped step is
  named. "Done and verified" only when both words are true.

## Collaboration protocol

- Claude sessions work in this same tree, sometimes concurrently. Before starting:
  `git status` — files you didn't touch and don't recognize belong to someone else; stage
  around them and leave them alone.
- If the suite goes red on something UNRELATED to your change, stop and report rather than
  fixing another agent's in-flight work.
- When a brief is ambiguous, ask the owner instead of guessing. Flagged uncertainty is valued;
  silent guessing is not.

## Shipping hygiene for multi-workstream handoffs (P8, 2026-08-13)

- **One commit per workstream.** The v1.601 handoff squashed W2, W6 and W7 into a single commit
  whose own documentation admitted the three "cannot be reverted or bisected apart" — and when a
  W2 defect later blacked out quest credit in the live campaign (#175), attribution archaeology
  worked only because the defect happened to sit in that one commit. Stage each workstream as its
  own commit with its own version marker resolving to a real tree; a "staged internally as
  v1.NNN" note in prose is not a tree.
- **A sabotage gate must name its section AND its test.** Two failure shapes shipped green
  gates that proved nothing: a filter arg matching zero sections "passed" on the typo-guard's
  own exit code, and an exit-status-only verdict let unrelated reds vouch for unrelated guards
  (2 of 25 v1.601 W7 clauses were actually caught by pre-#168 sections). Use a real section name
  in the command and a `mustFail` substring naming the guarding test — `dev/sabotage.js` reports
  MISATTRIBUTED when the wrong red catches a mutation.
