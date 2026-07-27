# Traffic and Dragons — Session Handoff (2026-07-27: #95.4→#99, the voice-casting payoff)

**Deployed:** `v1.461` (globals.js) · CACHE `tnd-v3-20260727h` (sw.js) · Piper runtime **r9** (untouched)
**Tests:** 858 assertions green · **Branches:** both repos committed + pushed, trees clean
**Fly apps:** game server redeployed twice (the `prefs` store) · `tnd-tts` untouched
**Models this session:** Opus 5 + Fable (design/build) · 3 Explore agents for the parallel-lane mapping

## Nothing is blocked. Two things want YOUR hands, not code

1. **#78 — Car Mode numbered options: needs a real drive.** Built and lab-verified, deliberately
   left ACTIVE and in-progress rather than closed. The gate is field feel: mic accuracy over road
   noise, whether the 3s options-hold reads as responsive or laggy, and whether hearing the menu
   every single turn is welcome or wearing. CAR_MODE.md names Web-Speech-in-a-moving-car as the one
   risk that could still change the design (ties to #19).
2. **#94 — the piper-high ear check.** Unchanged from the last handoff: five minutes of listening
   and a default-voice decision. All numbers are already in the row; nothing to measure.

## What shipped (v1.443 → v1.461, 35 commits)

- **The #95 casting arc COMPLETED and paid off.** The star bench went per-origin-broken →
  cloud-synced → gendered → auto-casting. In order: **#95.4** export/import (the field bug: bench
  starred on file://, game on pages.dev, so the ★ optgroup was empty — not a defect, a per-ORIGIN
  store); **#95.5** account-level cloud sync via a new `prefs` table + `GET/PUT /api/prefs/:key`
  (key-allowlisted, array-only, ≤100KB, rev-per-write LWW); **#95.6** the dev's curated 52-voice
  bench became the DEFAULT for new players (served only when the store was NEVER written — a
  stored `[]` stays deliberately cleared); **#95.7** structured MUTABLE gender on stars +
  gender-matched auto-cast; **#95.8** per-voice gender overrides on the MAIN table + Push/Pull
  buttons replacing the one-day-old file export/import.
- **#96 — [SAY:] dialogue attribution replaced the #9 LLM speaker post-pass.** The GM now names each
  speaker as it writes; `deriveSpeakerMapFromTags` binds them deterministically. **Deleted:** the
  per-turn 400-token speakers call, its 4s wait fuse, the 60-unit cap, and five functions — net
  −141 lines, and narration no longer waits on a round trip. Hardened the same night through three
  field reports (below).
- **#97** the B9 bypass lever removed · **#88** suggested actions punctuated · **#30** renders reach
  Photos (phone) / the campaign folder (desktop) and survive a reload · **#98** appearance-from-image
  now describes DURABLE traits · **#99** "Replace appearance" actually replaces.
- **Backlog audit:** #9, #15, #76, #86, #87, #88, #91, #95, #96 closed or ruled; every section now
  sorted ascending. Active list: **18 rows**.

## The field-report loop that defined the session (read this part)

Four separate bugs were found by the user in play and fixed within the hour. The pattern worth
copying: **pull the real evidence before theorising.** The GM's raw responses live in the server's
`session_log`, and replaying one through the real pipeline settled each question in minutes.

- **"voice tagging isn't working, everything."** Server evidence: 3/3 recent responses dialogue-heavy,
  **zero** `[SAY:]` tags. The sessionLog full of the GM's own untagged prose out-momentumed a fresh
  doc line — the known *prompt-channel-beats-position* class. Fix: `buildSayComplianceNudge`, an
  engine-note that fires while the last response had dialogue and no tags, and goes silent the moment
  compliance starts (v1.449).
- **"one out of 4 bits of dialog properly assigned."** The nudge had worked (5 tags in the live
  response) — the DERIVER was wrong twice: it matched only each tag's FIRST quote (real speeches are
  multi-span: `"Steady," she says. "First time…"`), and #93's adjacent-paragraph span merge glued two
  speakers into one span. Reworked to unit-level segment claiming; the real field response went
  **3 → 18 voiced units**, and that exact turn is now a test fixture (v1.451).
- **"Ameiko has a voice, Hemlock gets the narrator."** Not a casting bug — there was NO UI path to a
  non-party NPC's sheet, so one could never be generated for voice resolution to read (v1.452).
- **"desktop brings up a 'share' UI."** Desktop Chrome implements `navigator.share` too, and I had
  ordered share-first. A configured folder is an explicit instruction and now always wins (v1.458).

## Gotchas that cost time (READ before touching the same surfaces)

- **`bash` ate every `backticked` identifier in a TODO row** written inside a double-quoted shell
  string — command substitution blanked `char.appear`/`buildSysPrompt`/`doRender` out of the text and
  the row shipped reading "Why it is not cosmetic:  is CANON". **Write TODO rows from a script FILE**
  (scratchpad + node), never a shell string. Also: no Python on this box; `/tmp` in node resolves to
  `C:\tmp`, not bash's `/tmp`.
- **The in-app preview serves CACHED js** even after the `fetch → document.write` reboot trick. New
  functions come back `undefined` and it looks like a load-order bug. Re-`eval` the changed files
  with a cache-buster: `(0,eval)(await (await fetch(base+f+"?b="+Date.now())).text())`.
- **Stubbing a global in one browser test poisons the next** (`String(showNpcSheet)` returned my
  stub, and two contract checks read false). Re-eval the real file before asserting on source.
- **The character sheet is a STATIC render** — it paints its rows once, at open. Any modal that
  overlays the sheet and edits a sheet-visible field must repaint **on close** (`pmClose`), not
  per-write: the portrait modal sits at z-index 400 over the sheet's 300, so a mid-flow repaint is
  invisible anyway. This is the #99 lesson and it will recur.
- **Removing a diagnostic can hard-exit the suite:** a source contract in `dev/run-tests.js`
  `process.exit(1)`s on a grep, so deleting the code it guards *before* the contract kills the test
  run before a single test executes. Map the contract surface first (#97).

## Open rows / queues

- **#78** (drive it) · **#94** (ear check) — the two above.
- **todo_checkWithFable #7** — the `/fable-review` pass over the #95 arc. Now larger than when it was
  filed: the arc grew #95.4→#95.8 plus all of #96. Run via `/fable-review 7`.
- **#92** — sync-payload compression. Row carries the corrected design (the server-adopt pull path
  consumes blobs RAW — `parseWorldState` tolerance does NOT cover that hop) + the transcript-memo
  enforcement decision. Fable, one session, real-blob test bed.
- **#93** — RESCOPED this session and now sharper than it looks: #96 killed the span-merge half, but
  the surviving unclosed-quote parity inversion became *more* dangerous — the deterministic deriver
  will mechanically read inverted NARRATION in a character's voice.
- **#77** (STT read-back), **#81/#82** (item bible → tooltips), **#72** (levelling), **#73** C4/C5
  (clock display + calendar), **#1** (networked co-op only).

## Where to start next session

1. Ask how #78 and #98 felt in play — both shipped without field validation.
2. `/fable-review 7` whenever there's slack; it now covers a much bigger arc than when filed.
3. #92 as its own Fable session with the mature blob.
