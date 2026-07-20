---
name: playtest
description: Automated multi-turn playtest over the real GM — "/playtest run [N]" installs dev/playtest-harness.js and drives N turns against a throwaway campaign, "/playtest audit" judges the persisted corpus and writes audits/AUDIT_playtest_v<ver>.md, "/playtest recover" rescues a corpus from a closed window. Use whenever the user asks to run a playtest, drive N GM turns, smoke-test the engine end to end, or judge prose-voice/content-DNA drift over a long run.
---

# /playtest — automated multi-turn playtest + audit

Harness: `dev/playtest-harness.js` (dev-only, never referenced by index.html — running it never
bumps APP_VERSION/CACHE). Corpus: `localStorage['tnd_pt_corpus_v1']`, persisted after every turn
AND every GM response. Audits land in `audits/`, corpora in `dev/corpus_playtest_v<ver>.json`.

**A run ALWAYS ends in a durable audit** (user rule). Persist the corpus to `dev/` and write the
audit file BEFORE the analysis gets long — a closed window must never cost the run's evidence.

**Model tiering:** driving turns is mechanical — dispatch it to a **Sonnet** subagent. Judging the
corpus (prose drift, tag fidelity, invariant breaks) is **Fable** — the intelligence lives in the
protocol and the evaluator, never the runner.

**Never type or paste an API key.** If `tnd_ak_v1` is unset, stop and ask the user to enter it in
the visible preview themselves.

## /playtest run [N]

Default N = 10. Turns cost real money — state the estimate and confirm before a run over ~25.

1. `preview_start` the app (`.claude/launch.json`), then via `javascript_tool`: wipe `tnd_*` keys
   EXCEPT the provider keys (`tnd_ak_v1`, `tnd_provider_*`), reload, and confirm you land on
   `#char-screen` — a stale `#game-screen` means the wipe didn't take.
2. Build a minimal valid v10 character and `startGame(char, tone.nm, tone.vc, "<authorId>")` —
   the file header (lines 20–38) has the working template. Read `AUTHORS`/`TONES`/`CLSS`/`ANCS`
   live from the page for valid ids; ask the user for tone + author if they didn't say.
   Wait ~20–30s (Bash sleep, not an eval sleep), then poll `!!worldState.skeleton`.
3. Paste the harness file contents into `javascript_tool` ONCE to install.
4. Drive in batches of 5–10: `window.__ptRunBatch(n)`. Later batches are fire-and-forget — the
   page keeps running past the ~30s tool timeout. Poll `window.__pt.log.length` and
   `window.__pt.errors`; a client-side timeout is NOT a failure, just re-poll.
5. When the log reaches N, write the corpus to `dev/corpus_playtest_v<ver>.json` immediately, then
   run `/playtest audit`. Report turns completed, errors, and cost to the user.

## /playtest audit

Judges the corpus already on disk (or in localStorage — pull it first, then persist).

1. **Invariants (smoke half)** — walk `log[]` for: HP within `[0, maxHp]`, gold/xp monotonic where
   they should be, `combat` cleared after all foes down or on a location change, `foes[]` in the
   UA26 shape, `sessionTokensApprox` crossing `SUMMARIZE_AT` and coming back down (summarize
   fired), and `errors[]` empty. Every break gets a turn number.
2. **Tag fidelity** — `__pt.raw[]` holds the raw GM responses. Check the tags the turn's prose
   implies actually landed (spend → `[GOLD:-N]`, taking → `[ITEM_GAINED:]`, quest close, combat
   lifecycle). A narrated effect with no tag is a silent desync — the failure class this run exists
   to catch.
3. **Prose-voice / content-DNA drift** — sample turns spread early/mid/late (plus any combat
   window); don't pull all N narrations. Compare against the live
   `AUTHORS.filter(...)[0].vc`/`.contentDNA`. Verdict: holding steady vs. drifting toward
   generic/flat, with concrete before/after quotes.
4. Write `audits/AUDIT_playtest_v<ver>.md` in the house shape: **Run** header (turns, save, model,
   cost, corpus link, what commissioned it) · a bolded one-paragraph **Verdict** · a **checks**
   table (check | ✅/❌ + evidence) · honest negatives recorded as their own rows · a closing list
   of what graduates to TODO.md and what stays on the play checklist.
5. Land TODO.md rows for anything actionable (TLDR-first). Commit the audit + corpus together;
   harness-only runs don't bump APP_VERSION.

## /playtest recover

`window.__ptLoad()` returns the persisted corpus after a crashed/reopened window (at most the
single in-flight turn is lost). Dump it to `dev/` and go straight to `/playtest audit`.
`window.__ptClear()` wipes it — only before a deliberately fresh run, never to tidy up.
