# Traffic and Dragons — Session Handoff (2026-07-25, the marathon: #90 through #95.3)

**Deployed:** `v1.442` (globals.js) · CACHE `tnd-v3-20260725a` (sw.js) · Piper runtime **r9** (untouched)
**Tests:** 828 assertions green · **Branches:** both repos committed + pushed, trees clean
**Fly apps:** game server unchanged · **`tnd-tts` LIVE** (the #90 M1 app: suspend mode, 1GB, 3GB volume,
`TTS_TEST_SECRET` **unset** — the set→verify→unset ops lever, never leave it set)
**Models this session:** Fable (design/verdicts/integration/ops) + Opus 5 agents (builds/evidence — Opus 5 released 2026-07-24)

## ⚠ OPEN FIELD BUG — pick this up FIRST

**The ★ Cast voices optgroup is NOT appearing in the game's Voice Settings dropdown** (user screenshot,
end of session: only the 19 base models listed). Undiagnosed — context ran out. Ranked hypotheses:
1. **Origin mismatch (most likely):** stars live in `tnd_speaker_stars_v1` on the ORIGIN where the
   user starred (they opened `speaker_browser.html` from **file://** — their failed-fetch screenshot
   proved that context). If the game tab in the screenshot runs on **pages.dev**, its localStorage
   simply has no stars — the S5 "device store" design silently became an "origin store" on desktop.
   Check FIRST: ask which URL the game tab uses, and read `localStorage.tnd_speaker_stars_v1` on each
   origin. Fix directions: stars-export/import button in the browser panel; or write stars through
   the game origin; or promote stars into the sync blob (design change — user call).
2. The game tab predates v1.440 (needs one reload cycle — CACHE moved twice since).
3. A real defect in `starOptionsHtml`/`_buildPiperVoiceOptions` wiring (agent-D-built, engine-tested
   with a stubbed store — the test can't see an origin split).
Verify per CLAUDE.md discipline: reproduce under the user's exact origins before any fix.

## The day, compressed (13 engine versions, 2 Fly deploys ×4, ~2.6M agent tokens)

- **#90 M1 SHIPPED (v1.435):** server-side TTS on the new `tnd-tts` Fly app — the B9 architectural
  close. `TTS_LADDER = server → piper → native`; `_speakServer` = the piper unit loop with
  predict()→fetch; remainder-handoff on any unit failure; governor meters local tier only. Full
  as-built in TODO #90 row. Live-verified end to end incl. the failure ladder (real degrade →
  local Piper actually spoke).
- **Cold-start close (v1.436 + server):** Fly parked the machine after ~2min idle → every post-idle
  read's unit 0 paid a measured 10.17s cold chain (timeout = degrade = 🔋 latch). Fixed: fly.toml
  `auto_stop_machines="suspend"`, `prewarmServer()` on the send tap, 15s first-unit timeout, ▶ Test
  through the ladder, `tts-server-skip` attribution crumb. Then **stale-while-error auth** (server):
  a sleeping game server 503'd reads mid-session; tokens validated within 24h now ride through
  backend outages (throttled re-checks; `grace` stamp separate from `at` so the horizon can't
  become infinite).
- **B10 recovery chain (v1.437-438, all field-driven same-day):** tap recovery escalates to rebuild
  on the 2nd attempt on a stuck ctx (suspended ≠ only "interrupted"); watchdog re-arms the one-shot
  unlock every poll; frozen-audio-clock zombie detector (`ctx-zombie` crumb); and the rebuild now
  RE-READS the interrupted item (captures `_curItem`, keeps the queue) instead of discarding it with
  a lying "Speaking…" bar. User-validated: "the resume worked great." AUDIO RECOVERY CONTRACT
  clauses ④-⑦, all sabotage-proven ON SCRATCH COPIES (see gotchas).
- **The delegated-review workflow VALIDATED:** /fable-review skill created (.claude/skills/fable-review).
  First run: 6 parallel Opus evidence briefs (~843k tok) over todo_checkWithFable entries 5/2/4 →
  **10 confirmed defects fixed as v1.439** (headliners: the 11-site raw-`/\bdead\b/` class that let
  slain companions haunt the party cap and never fire death moments — all through `npcIsDead()` now;
  the attitudeSpec heal-marker wiping NEW campaigns' correct data — marker now born on blankMemory +
  carried through .tnd import; summarize-catch masking vectors; blueprint role fan-out
  re-contaminating mood/attitude). Queue emptied; perf review + receipts in FABLE_REVIEW_ACTION.html.
  **Verdict: adopt the pattern; verdicts stay Fable** (2× total tokens, ~60% Fable-quota saving,
  BETTER depth). v1.441 followup: the 2MB sync toast latches per-campaign (store-wrapper-backed —
  the harness's quota stub caught fail-open re-firing).
- **#91 Kokoro: D4 GATE FAILED, blocked on economics** (DOC/DOC_kokoro.html has spec + numbers):
  OOM at 1GB; at 2GB RTF ≈2.1 best-case then burst-throttle collapse to 22-34 (3m56s for one line).
  Piper = RTF 0.16 same box. K1-K3/K6 remain rebuildable. **#94 answered by field logs same day:**
  the live session was ALREADY running `libritts-high` — RTF ~1.0 (6× medium's cost, break-even,
  zero margin). Remaining: user's ear + default-choice judgment (row has the full framing).
- **#95 SPEAKER CASTING SHIPPED (v1.440):** the 904-speaker un-shelving of #9⑦ — `model#speaker`
  ids end to end (server range-validates against the model's own config; client `voiceBaseId()`
  normalization everywhere incl. the protection layer; S2: local reads strip to base, loudly).
  `speaker_browser.html` satellite + ★ Cast voices optgroups (sheet + Voice Settings). Four parallel
  Opus 5 builds + Fable integration; contracts ⑤-⑨.
- **#95.2 (data):** all 904 got real reader NAMES (published table, 0 mismatches) + honest acoustic
  descriptors ("deep, measured, lively") from a Fable-run paced server batch (904/904, 0 failures;
  within-gender pitch terciles). Browser filters/sorts by them; live star tally ("1m / 1f selected");
  metadata EMBEDDED in the page (file:// blocks sibling fetch — field report).
- **#95.3 (v1.442):** accents answered honestly — none exist for LibriTTS (corpus + LibriTTS-P's
  7,329 rows: zero accent terms); **VCTK is the accent-tagged stable**: `vctk_speakers.json`
  (109/109, five byte-identical mirrors, 13 verbatim accents incl. 19 Scottish-by-city) + same
  acoustic pass + model switcher/accent dropdown in the browser (cross-model stars; 79/79 headless
  assertions; byte-identical DOM diff for the untouched view). Integration hardening: a warn banner
  can never overwrite applied metadata (the lying-banner race).

## Open rows / queues

- **The star-origin field bug above** — user has starred a bench and can't assign; blocks the
  payoff of the whole #95 arc.
- **todo_checkWithFable #7** — /fable-review pass over the #95 arc (5 named verify items incl. the
  voiceBaseId sweep and the S2 strip boundary). Run via `/fable-review 7`.
- **#92** — sync-payload compression; row carries the CORRECTED design (the server-adopt path
  consumes blobs RAW — `parseWorldState` tolerance does NOT cover the pull hop) + the transcript-memo
  enforcement decision (entry-4 ★ verdict). Fable, one session, real-blob test bed.
- **#93** — B14 splitter edges (parity inversion, adjacent-para span merge, lone-quote unit).
- **#94** — piper-high default: judgment call, numbers all in the row.
- **B17** — location-history design talk (findings-ready, Fable).
- **#88** — suggestion punctuation (S, Sonnet).
- LibriTTS-P impression words ("husky", "elegant") noted as a future descriptor enrichment — parked,
  not filed.

## Gotchas that cost time (READ before touching the same surfaces)

- **The in-app preview pane NEVER re-executes a loaded page** — location.reload(), forced navigate,
  and new tabs all serve the original document. The only re-boot: `fetch(url) → document.open() →
  document.write(html) → document.close()`. Console capture also DUPLICATES every line (treat
  doubled warns as capture noise), and its network monitor doesn't record cross-origin fetch()
  (Fly logs are the authority).
- **Never `git checkout` an engine file to restore it** — autocrlf writes CRLF and every \n-anchored
  contract regex breaks (looks like unrelated contract failures). Sabotage-test guards against
  SCRATCH COPIES only. Also: the Write tool can serialize `\xNN` escapes as RAW control bytes
  (grep suddenly says "binary file"); hex-dump to confirm, byte-level replace to fix.
- **PS 5.1 mangles native args containing spaces+quotes** (curl -d JSON → words become URLs;
  multiline git -m via here-string can shatter) — body-from-file (`-d @file`, `git commit -F file`)
  is the reliable form. Git-Bash `/c/...` paths reach node as literal `C:\c\...` — pass `C:/...`.
- **Fly autosuspend keys on HTTP idleness, not CPU** — SSH-launched work gets frozen mid-run
  (corrupts timings) unless something curls /health each poll. `flyctl secrets set/unset` restarts
  the machine (a post-unset curl can 503 during boot — re-verify, don't panic).
- **The `TTS_TEST_SECRET` lever** (tts/index.js): set → verify → UNSET, every time. Used 3× today,
  retired 3× (401-verified).
- **The acoustic batch pattern** (scratchpad/acoustic-batch.mjs + merge-acoustics.mjs, both
  parameterized): paced ~30% duty so narration never competes; resume-safe; run LOCALLY against
  the authed endpoint. 904 speakers ≈ 21min, 109 ≈ 2.5min.

## Where to start next session

1. **The star-origin bug** — diagnose with the user's actual origins, then pick the fix tier
   (export/import vs game-origin write vs sync-blob promotion — the last is a design call).
2. `/fable-review 7` (the #95 arc audit) whenever there's slack — the skill runs the whole pattern.
3. #94's ear-check conversation is 5 minutes of the user listening and deciding.
4. #92 + the memo enforcement, as one Fable session with the mature-blob test bed.
