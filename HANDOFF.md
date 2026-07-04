# Traffic and Dragons — Session Handoff

**Date:** 2026-07-04 (the RAG marathon session — ran overnight from 07-03)
**Deployed version:** v1.164 (`APP_VERSION` in `globals.js`) — **pushed AND live on Cloudflare Pages, deploy-verified.**
**SW cache:** `tnd-v3-20260704c` (`sw.js`).
**Branch:** `master` — pushed through `6b80ee2` (`origin/master` == local HEAD). Working tree clean.
**Server:** healthy on Fly; health-monitor cron re-armed by the push.

> **STANDING RULE: every commit is gated on the engine test suite.** `.git/hooks/pre-commit`
> runs `dev/run-tests.js` (**now 91 assertions**, headless node, ~1s) and BLOCKS on red. Suites live
> in `dev/engine-tests.js` (shared with test.html). Hook isn't tracked — after a fresh clone:
> `cp dev/pre-commit .git/hooks/pre-commit`.
> **Host:** Cloudflare Pages ONLY. Read `CLAUDE.md` first for architecture; this file is "where we left off."

---

## FIRST THING NEXT SESSION: TODO #28 — summarize-tail retention (user-committed)

The user plays a morning session first (gathering evidence), then we build. The spec, from the
t160 corpus findings: in mature campaigns `summarize()` fires **every ~2 turns** (prose-voice
responses are 1,300–3,100 chars; `SUMMARIZE_AT`=1200 tok was tuned in the sentence-cap era) and
clears `sessionLog` to ZERO — the GM's verbatim window is ~2 turns deep and object-level facts
evaporate (the pin-grab confabulation, RAG_MEMORY.md §5b). **Fix: after a successful summarize,
RETAIN the last 2–3 exchanges in sessionLog instead of clearing.** Extraction unchanged (no RAG
write-side violation). Watch: the retained tail re-counts toward `SUMMARIZE_AT` — make sure the
loop can't thrash. Engine-testable. Side effect: halves summarize cadence = cost relief.
Behind it: **#29** (futureEvents auto-expire — 30-cap pegged with long-resolved items injecting
noise every turn; start with expire-by-`setTurn`-age).

---

## This session's work (15 commits, v1.153 → v1.164, all pushed)

| Ver | What |
|---|---|
| 1.153 | **Anne Rice** prose voice (`AUTHORS`, data.js). Docs: RAG_MEMORY.md design locked; restore runbook (`dev/restore-server.md`); TODO reconcile; `audits/` + `*.tnd` gitignored. |
| 1.154 | **RAG episodic memory Phase 1 (TODO #27)** — entity-keyed retrieval over the verbatim transcript, read-side only, default OFF, per-campaign flag `worldState.ragMemory`, Dev Mode ▸ 🗂 Episodic memory…; memoryTOC diet behind the same flag (flag-off = byte-identical, engine-tested). See CLAUDE.md §8b + RAG_MEMORY.md. |
| 1.155 | **Save-filename race fix** — exportSave built the filename at dialog-open but serialized state at click; the async server reconcile could swap worldState in between (the t4-name-on-t139-data incident). Unedited filenames recompute at click time. |
| 1.156 | **Blueprint Designer foundation** — `normalizeBlueprint`/`normalizeToneId` (game.js) at every load point; §5.2 tone-apply fixed (dead `#tone-grid` selector since v1.133 — closed AUDIT_FABLE #24); Runelords fixture corrected; `buildBlueprintFromGame` → game.js, emits `author`+`tone`, full-knowledge NPC notes. |
| 1.157 | **Blueprint Designer editor page** — `blueprint-designer.html`, fully EXTERNAL (D5 revised; test.html pattern — loads real engine files, never writes game state keys). Full nested act/arc editing, dnaHint field, validation, lossless round-trip (R5.3 verified). Remaining chunks: Generate mode, dnaHint button, cloud library, edit-active-game. |
| 1.158 | **File menu reorg** — 💾 Save/Load drawer + 📖 Narrative options drawer (in Admin). **Designer menu entry EXCISED by user preference** — open the page directly. |
| 1.159 | **File menus generated from ONE spec** — `buildFileMenus()` (ui.js); ~37KB of triplicated HTML deleted from index.html. **Convention: edit the spec, never index.html** (mount divs are empty). |
| 1.160–161 | **Desktop flyout submenus** — drawers pop out beside the menu; side chosen by measuring the parent item and flying away from the closest screen edge (user's algorithm); ≤768px falls back to the accordion. Also fixed `#hud-btns` left-parking at mid widths. |
| 1.162–164 | **RAG scoring v2/v3 + dead-zone fix** — four rounds of live-quiz-driven tuning, every defect forensically replayed against the t160 save. See "RAG state" below. |
| — | Docs/decisions: turn-guard CAS locked (known-issue #5: POST carries `baseTurn`, server 409s when ahead; no per-turn preflight); t160 corpus findings → TODO #28/#29; retcon-pollution watch item; drift-detection protocol parked (RAG_MEMORY §5). Haiku free-tier idea SHELVED by user — don't re-pitch. |

## RAG state (read RAG_MEMORY.md §5b before touching scoring)

- **Live tuning found 7 defects in one night, all from the user's in-game quizzes:** flat party
  scores → recency degeneration; topical query words discarded; proximity dedupe eating the answer
  turn; full-key name scan missing honorific NPCs ("Hemlock" vs key "Sheriff Belor Hemlock");
  duplicate NPC keys tripling scores; common-word stoplist whack-a-mole (→ IDF); fixed 10-turn
  recent-skip vs the 2-turn sessionLog (→ dynamic skip; the dead zone).
- **Current shape:** entity-gated + IDF lexical + party demotion (0 when input names someone) +
  dupe-collapsed scan identities + near-par neighbors both serve + oldest-first ties + dynamic
  skip window. `ragRetrieve._cands` = introspection hook.
- **User's campaign (t~166): flag ON; Hemlock ×3 + Woman-in-Bronze merges EXECUTED** (toast-verified).
- **Top RAG follow-up: `[RETCON:]` de-index marker** — retcon pollution is LIVE (the pin query
  serves the true t147 scene AND the t160 false correction). Then: Table Talk lore-oracle
  (TT uses a bare sysOverride — no memory, no RAG; append `ragRetrieve(input)` to its prompt).
- **Known residuals (documented, don't chase):** first-meeting-class queries (firstEncounter's
  job); single-turn quote precision (cluster-correct is the reliable unit; scene-stitching if
  play demands it).
- **Forensic replay pattern:** geval engine files like `dev/run-tests.js`, assign the save to
  worldState/memory/sessionLog, set flag + turn, call `ragRetrieve(question)`, inspect `._cands`.
  **`Rise_of_the_Runelords__Ammut__Ammut_t160.tnd` (repo root, gitignored) is THE mature-campaign
  fixture — do not delete.** Treat .tnd exports as frozen fixtures, not saves.

## Next session, in order of value

1. **TODO #28** (summarize-tail) — see top block. Then **#29** (futureEvents hygiene).
2. **`[RETCON:]` marker** if morning play surfaces stale-retcon answers.
3. **Blueprint Designer remaining chunks** — Generate mode (reuses `generateSkeleton`), dnaHint
   button, cloud library in the designer, edit-active-game, browser "Edit in Designer" link.
4. **Turn-guard CAS build** (server-touch session; small) + retry `flyctl volumes destroy
   vol_r7yw0lnl3lejpm1r --yes` (was 408ing while its dead host lingered).
5. **todo-viewer fix-up** — it clobbers statuses on stale-load export and mints duplicate IDs
   (two #22/#23/#25/#26 in TODO.md). Until fixed, re-verify Done rows after viewer edits.

## Don't get burned

- **RAG invariants:** stable prompt half must stay byte-identical (cache); flag-off must reproduce
  the pre-RAG prompt byte-for-byte (engine-tested); retrieval is READ-SIDE ONLY — never weaken
  `summarize()` extraction; excerpts are episodic texture, never current truth.
- **File menus are generated** — edit the spec in `buildFileMenus()` (ui.js), never index.html.
- **Blueprint Designer has NO menu entry on purpose** (user's single-purpose-tools philosophy —
  one job per surface; prefer new satellite pages over growing index.html).
- **DOM-id renames:** grep for the id before deleting any element — the tone-grid bug sat
  invisible for 20+ versions because a remote consumer kept querying a removed element.
- **PowerShell here-strings with certain content break `git commit -m`** — use `git commit -F <file>`
  (write the message to the scratchpad). Bit twice this session.
- **User's play tab is the LOCAL file:// copy** — no SW there, but hard-refresh after engine
  changes; deployed site now matches anyway. Preview on :3000 has its own localStorage.
- **ES5 only**; bump `APP_VERSION` + `CACHE` on every game-code commit; **push at session end**
  (new habit, user-endorsed — everything is flag-gated, and days-long unpushed windows are a
  single-disk bet).
- **User preferences on record:** no Haiku pitches; data cleanup only when it gates a measurement
  (instrument-calibration framing); wait for full answers before acting.

## Deploy

- **Cloudflare Pages** auto-deploys on push to `master`. Poll `globals.js?nc=<ts>` for `APP_VERSION`.
- **Server:** `cd traffic-and-dragons-server && flyctl deploy --ha=false` (separate untracked repo).
