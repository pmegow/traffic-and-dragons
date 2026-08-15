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

## Model-comparison runs — the standard campaign (owner ruling 2026-08-15)

When a run's purpose is comparing MODELS/PROVIDERS (not exercising fresh skeleton generation),
**every run starts from the same fixed campaign** so results are apples-to-apples:

- **Blueprint:** `samples/modeltestcampaign.blueprint` (exported from the 50-turn gemini-3.5-flash
  baseline run at v1.635 — tone `swords`, Howard voice, The Blighted Reach / Crossroads of
  Ashenveil, 3 acts, 8 NPCs). Do NOT regenerate the skeleton; the blueprint IS the control.
- **Character:** the exact Korrag template — Northlander Human Warrior, STR 16 / DEX 12 / CON 14 /
  INT 10 / WIS 10 / CHA 13, gold 40, Longsword + Chainmail, True Neutral, trait "Blunt", flaw
  "Distrusts sorcery", motivation "Coin and a quiet conscience" (the harness-header template with
  these values; name/gender/age: Korrag / M / 32). Same seed every run.
- **Start procedure (headless):** fetch the blueprint file, `validateBlueprint(bp)` must return
  falsy, then set the global `pendingBlueprint = bp` and call
  `startGame(char, tone.nm, tone.vc, "howard")` with `tone = TONES.filter(t => t.id === bp.tone)[0]`
  (ES5 in the page: use `function(t){...}`). `startGame` applies the blueprint and SKIPS skeleton
  generation. `_campName`: `modelTestCampaign_<provider>`.
- **Artifacts:** save → `testRuns/modelTestCampaign_<provider>.tnd`; corpus →
  `dev/corpus_playtest_v<ver>_<provider>.json`; audit → `audits/AUDIT_playtest_v<ver>_<provider>.md`,
  judged against the gemini baseline (`dev/corpus_playtest_v1635_gemini.json`,
  `audits/AUDIT_playtest_v1635_gemini.md`) — same 50-turn shape unless the user says otherwise.
- First live comparison signal on record: the owner judged the Howard voice CLEARER on
  gemini-3.5-flash than Sonnet (see the baseline audit's "Owner field verdict").

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
   to catch. **Unknown-tag census: derive the known list FROM `tag_table.js`** (TAG_TABLE handler
   names + TAG_NO_HANDLER + the strip-only names), never from a hand list or the docs index — the
   2026-08-15 gemini audit falsely flagged two LEGITIMATE tags (`SCENE_DEATH`, `LOCATION_SIZE`)
   because its census list was hand-built.
3. **Prose-voice / content-DNA drift** — sample turns spread early/mid/late (plus any combat
   window); don't pull all N narrations. Compare against the live
   `AUTHORS.filter(...)[0].vc`/`.contentDNA`. Verdict: holding steady vs. drifting toward
   generic/flat, with concrete before/after quotes.
3b. **Narrative COHERENCE (mandatory since the 2026-08-15 gemini lesson — per-turn checks masked
   cross-turn incoherence; the owner caught it only by reading the compiled story).** Three parts:
   ① **dead-actor scan** — for every `[NPC:name|dead]` in `raw[]`, flag any LATER `log[]` narration
   where that name speaks or acts (substring match on the name is enough; the gemini run had
   Theron shrieking two turns after his death tag); ② **thread-dropout** — take the opening
   premise's key nouns (caravan, patron, macguffin) and check they appear after the first act's
   turns — a premise mentioned only in the first ~7 turns of 50 is a dropped thread; ③ **read the
   compiled narrative** (`buildNarrativeHtml(worldState)`) start to finish as a STORY, not a log —
   repeated kills, unexplained scene jumps, and resurrections only surface at this altitude.
   Tag-perfect turns can still be a broken story: tag syntax and canon obedience are separable.
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
