# CHECKPOINT — pre-housekeeping restore point

**TLDR:** everything tracked by git is recoverable from one commit (`df7b02b`), so the real
content of this checkpoint is the list of things git **cannot** restore, plus the invariants to
re-run after any file move so a broken move is caught immediately instead of at the next deploy.

Created 2026-07-27, immediately after the entry-7 Fable review shipped, before any directory
reorganisation. Delete this file once the housekeeping has landed and been verified.

---

## 1. The anchor

| | |
|---|---|
| **Commit** | `df7b02b16c303811ab8d26662763004b0bd986af` |
| Short | `df7b02b` — *fix: fable-review entry 7 (the full #95 arc + #96) — 6 confirmed defects + 6 hardens (v1.462)* |
| Branch | `master`, **in sync with `origin/master`** (pushed) |
| `APP_VERSION` | `v1.462` (globals.js:163) |
| `CACHE` | `tnd-v3-20260727i` (sw.js:1) |
| Piper runtime | **r9** (unchanged this session) |
| Test baseline | **`ALL GREEN — 861 assertions passed`** |
| Tracked files | **174 total · 77 at repo root** |
| Working tree | clean except untracked `Campaigns/` |

Because `master` is pushed, the tracked tree is recoverable even if this clone is destroyed.
`df7b02b` is the number that matters — every "restore" recipe below is built on it.

---

## 2. Branch and worktree state (read before deleting any worktree)

| Ref | Commit | Status |
|---|---|---|
| `master` | `df7b02b` | current, pushed |
| `worktree-agent-ac0da69bf4716b8ec` | `b0f1280` | **merged into master** — the #7 sound library. Nothing unique. |
| `claude/wizardly-mayer-df87c6` | `6ba16f5` | **NOT merged into master**, but **pushed to `origin/claude/wizardly-mayer-df87c6`** |

Two worktrees live under `.claude/worktrees/` (both from 2026-07-18, both with clean working
trees, both gitignored):

- `agent-ac0da69bf4716b8ec` → on branch `worktree-agent-ac0da69bf4716b8ec` @ `b0f1280`.
  Fully merged. Deleting it loses nothing.
- `wizardly-mayer-df87c6` → **detached HEAD** @ `6ba16f5`.
  The detached HEAD looks alarming but the same commit is the tip of `claude/wizardly-mayer-df87c6`
  locally *and* on `origin`, so it is safe from gc. Deleting the worktree loses nothing.

**The open decision** (unaffected by any cleanup): `6ba16f5` — *"feat(#72): local-server test
route — test-mode latch exempts localhost, pairing with the server's new dev-login (v1.366)"* —
is genuinely absent from master. Verified: `git grep _isLocalServer master` finds nothing, and
`storage-adapter.js` on master has no localhost handling. Its **server-side half was already
deployed** (env-gated `POST /auth/dev-login` in the server repo), so master and the deployed
server currently disagree about whether that feature exists. Cherry-pick, keep parked, or
consciously abandon — but decide it on its merits, not as a side effect of housekeeping.

Note `master`'s own v1.366 is a *different* change (`bdd01e0`, the B7 sync-reconcile fix). The
version numbers collide; the content does not.

---

## 3. What git CANNOT restore

This is the actual reason this file exists. Everything below is untracked or gitignored — a
`git checkout` will not bring any of it back. **Back these up before deleting or moving
anything.**

| Path | Kind | Why it matters |
|---|---|---|
| `Campaigns/` | untracked | Live campaign export folder (File System Access target). Currently 1 file: `Campaigns/Runelords/Rise_of_the_Runelords__Ammut_/renders/…Ammut_t1174.png`. **Not in .gitignore** — one stray `git add -A` would commit it. |
| `.claude/settings.local.json` | ignored | Personal Claude Code settings. Contains hardcoded absolute paths (see §5). |
| `.claude/bugs.local.json` | ignored | **The GAS `doGet` shared secret for `/bugs sync`.** Irreplaceable without re-deriving it from the Apps Script deployment. |
| `.claude/worktrees/` | ignored | The two worktrees above — recoverable from refs, see §2. |
| `audits/AUDIT_FABLE_07_01_26.md` | ignored | Fable working audits — local-only by design |
| `audits/AUDIT_FABLE_07_06_26.md` | ignored | ” |
| `audits/AUDIT_FABLE_07_06_engine.md` | ignored | ” |
| `audits/AUDIT_FABLE_07_16_2026.md` | ignored | ” |
| `dev/corpus_playtest_v1238.json.endstate.json` | ignored | Replay end-state snapshots — the cross-version byte-comparison baselines for `dev/diff-replay.js` |
| `dev/corpus_playtest_v1258.json.endstate.json` | ignored | ” |
| `dev/corpus_playtest_v1271.json.endstate.json` | ignored | ” |
| `dev/corpus_tagsoak_v1241.json.endstate.json` | ignored | ” |
| `diagnostic_playthru.tnd` (root) | ignored | Personal save — cited by `audits/AUDIT_PLAYTHRU.md` |
| `haikuPlaythrough.tnd` (root) | ignored | Personal save — cited by `audits/AUDIT_haiku_v1.230.md` |
| `playtest_v1.224.tnd` (root) | ignored | Personal save — cited by `audits/AUDIT_playtest_v1.224.md` |
| `playthrough_v1.214.tnd` (root) | ignored | Personal save — cited by `audits/AUDIT_playthrough_v1.214.md` |
| `testRuns/Rise_of_the_Runelords_t308.tnd` | ignored | **The mature-save test bed** (AUDIT_t308.md, the RAG/#92 evidence base). Hard to regenerate. |
| `testRuns/Rise_of_the_Runelords_t343.tnd` | ignored | ” |

⚠ The four root `.tnd` files and the two in `testRuns/` are the **evidence base for six audit
documents**. If they move, fix the citations in the same commit — an audit that can't reach its
corpus is a broken record, and the standing rule is that a test run always keeps a durable audit.

---

## 4. Invariants to re-run after ANY file move

A housekeeping move is "safe" only if all of these still hold. Run them **before** committing.

```bash
node dev/run-tests.js
```
Must print `ALL GREEN — 861 assertions passed`. This alone catches most breakage: `dev/run-tests.js`
reads specific root files by name for its source contracts — `tts.js`, `game.js`, `ui-sheets.js`,
`storage-adapter.js`, `speaker_browser.html`, `index.html`, `piper_test.html`, and
`vendor/piper/vits/vits-web.js`. Move any of those and the suite hard-exits *before any test runs*
(it `process.exit(1)`s on a failed contract — the #97 lesson).

```bash
node dev/lint-todo.js
```
Must print `TODO.md tables OK (334 lines)`. Hardcodes `path.join(__dirname, "..", "TODO.md")`, and
runs inside the pre-commit hook.

**Hand-check list** (no automated tripwire covers these):

1. **`sw.js` `APP_SHELL`** — 37 absolute paths (`/globals.js`, `/index.html` via `/`, `/manifest.json`,
   `/icon*.png`, `/icon.svg`, `/piper-host.html`, `/vendor/html-to-image/html-to-image.js`, all 26
   engine JS files). A moved shell file 404s at install and the SW never activates.
2. **`sw.js` network-first regex** — matches satellites by **name fragment**:
   `blueprint-designer|todo-viewer|bible_study|piper_test|npc-merge-studio|bug_tracker|voice_picker|speaker_browser|libritts_speakers|vctk_speakers|/test\.html|/DOC/`.
   A renamed satellite silently reverts to cache-first and pins stale (the bug_tracker lesson).
3. **`index.html` script tags** — 30 `<script src>` in a **load-order-sensitive** sequence
   (globals → error-report → compress → data → … → tts → stt). Order is a documented contract.
4. **`manifest.json`** — root-relative `icon.svg` / `icon-192.png` / `icon-512.png` + screenshot `src`.
5. **Cloudflare Pages** serves the **repo root** as the output dir. Moving any HTML changes its
   **public URL** — bookmarks and any `_redirects` entry break.
6. **`.claude/skills/*/SKILL.md`** reference `TODO.md` (×6), `todo_checkWithFable.md` (×3),
   `DOC/BUGS.md` (×3), `CLAUDE.md` (×2), `FABLE_REVIEW_ACTION.html`, `bug_tracker.html`, `index.html`.
7. **`bug_tracker.html:334`** hardcodes `fetch("DOC/BUGS.md")`.
8. **`DOC/DOC_technical_terms.html:7-8`** references `../glossary-icon.svg` and `../glossary-icon-192.png`.
   `blueprint-designer.html` references `designer-icon*`. Both cross directory boundaries.
9. **`dev/` node tooling** resolves via `path.join(__dirname, "..")` in 8 files
   (`load-engine.js`, `run-tests.js`, `lint-todo.js`, `diff-replay.js`, `capture-stable.js`,
   `bench-lz-memo.js`, `bench-rag-memo.js`, `npc-merge-tool.js`).
10. **`dev/npc-merge-studio.html`** loads engine files via `../globals.js`, `../compress.js`,
    `../data.js`, `../capability_bible.js`, `../helpers.js`, `../state.js`, `../storage-adapter.js`,
    `../memory.js`, `../tag_table.js`.
11. **Version discipline** — any commit touching game code bumps `APP_VERSION` **and** `CACHE`.
    A pure file-move still changes what the SW must fetch, so it counts.

---

## 5. Known pre-existing path landmines (not caused by housekeeping)

- `.claude/settings.local.json` and `.claude/hooks/stop-check.js` **hardcode absolute paths** to
  `C:\Users\hannu\OneDrive\Documents\Projects\dnd_rpg`. CLAUDE.md's "Known issues" already flags
  this against the pending `dnd_rpg` → `traffic-and-dragons` folder rename. Any directory rename
  must update both.
- The server repo lives **outside** this tree at `C:\Users\hannu\Projects\traffic-and-dragons-server`
  (moved 2026-07-12, the OneDrive exodus). It is *not* a sibling; don't assume relative paths.

---

## 6. Restore recipes

**Full rollback of all tracked files** (discards tracked changes since the checkpoint; leaves
untracked/ignored files alone):

```bash
git reset --hard df7b02b
```

**Inspect without moving HEAD:**

```bash
git diff df7b02b --stat
```

**Restore one file:**

```bash
git checkout df7b02b -- path/to/file
```

**Undo a bad housekeeping commit that is already pushed** (preserves history — preferred):

```bash
git revert --no-commit df7b02b..HEAD
```

**Verify a restore is genuinely back to baseline** — all three must hold:

```bash
git rev-parse HEAD && node dev/run-tests.js && node dev/lint-todo.js
```

Expect `df7b02b16c…`, `ALL GREEN — 861 assertions passed`, `TODO.md tables OK (334 lines)`.

**Confirm the root inventory is unchanged** (expect `77`):

```bash
git ls-files | grep -vc /
```

---

## 7. Root inventory at checkpoint (77 tracked files)

Diff against this list after housekeeping to see exactly what moved.

**Engine JS (30)** — all in `sw.js` `APP_SHELL` *and* `index.html` script tags, load-order sensitive:
`globals.js` `error-report.js` `wasm-probe.js` `compress.js` `data.js` `capability_bible.js`
`helpers.js` `state.js` `storage-adapter.js` `memory.js` `clock.js` `tag_table.js` `api.js`
`table-talk.js` `campaign_generator.js` `char-creation.js` `game.js` `ui-shell.js` `ui-panels.js`
`ui-portrait.js` `ui-files.js` `ui-sheets.js` `ui-browsers.js` `ui-campaigns.js` `ui-carmode.js`
`ui-modals.js` `ui-boot.js` `tts.js` `stt.js` `sound.js`

**App host / PWA (8)** — root-required: `index.html` `manifest.json` `sw.js` `piper-host.html`
`_headers` `_redirects` `.gitattributes` `.gitignore`

**PWA icons (3)** — referenced by `manifest.json`: `icon.svg` `icon-192.png` `icon-512.png`

**Satellite tools (8 HTML)** — CLAUDE.md keeps these at root by convention; matched by name in the
SW network-first regex; opened directly by URL/bookmark:
`blueprint-designer.html` `speaker_browser.html` `bug_tracker.html` `todo-viewer.html`
`bible_study.html` `voice_picker.html` `piper_test.html` `test.html`

**Satellite icons (6)** — cross-directory refs, see §4.8:
`designer-icon.svg` `designer-icon-192.png` `designer-icon-512.png`
`glossary-icon.svg` `glossary-icon-192.png` `glossary-icon-512.png`

**Satellite data (2)** — in the SW network-first regex: `libritts_speakers.json` `vctk_speakers.json`

**Blueprint samples (3)**: `planescape_torment.blueprint` `rise_of_the_runelords.blueprint`
`tomb_of_annihilation.blueprint`

**Docs — the housekeeping target (17, ~740 KB)**:
`TODO.md` (343K) `CLAUDE.md` (93K) `Fable_UberAudit.md` (74K) `todo_checkWithFable.md` (74K)
`HANDOFF_batch_v1260.md` (68K) `SERVER_ARCHITECTURE.md` (41K) `UI_SEAM_MAP.md` (30K)
`RESOLVE_NPC_INVARIANTS.md` (25K) `FABLE_REVIEW_ACTION.html` (24K) `RAG_MEMORY.md` (18K)
`BLUEPRINT_EDITOR.md` (13K) `CAR_MODE.md` (11K) `STORY_COMPILER.md` (10K)
`MULTI_ENEMY_COMBAT.md` (9K) `HANDOFF.md` (7K) `PRE_REVIEW_UA30_UA31.md` (5K)
`AUDIT_PLAYBOOK.md` (4K)

Recommended to **keep at root** if the docs move: `CLAUDE.md`, `TODO.md`, `HANDOFF.md`,
`todo_checkWithFable.md` — the daily working set, and `TODO.md` is hardcoded in `dev/lint-todo.js`.

**Subdirectories (97 tracked)**: `dev/` (33) · `DOC/` (21) · `testRuns/` (14) · `audits/` (12) ·
`vendor/` (8) · `.claude/` (8) · `.github/` (1)

*Section totals: 30 + 8 + 3 + 8 + 6 + 2 + 3 + 17 = **77 root** · + 97 subdirectory = **174 tracked**.*
