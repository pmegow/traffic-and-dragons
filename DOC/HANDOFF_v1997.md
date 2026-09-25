# Handoff — Fable session 2026-09-24/25 → next window

**Read this when** starting the #458 build (per-line emotion for Inworld) or picking up the day's loose ends.
Ephemeral per the trackers rule: open items live in TODO.md; this file archives when superseded.

## State

- **Live:** v1.997 (`APP_VERSION`, `sw.js` CACHE `tnd-v3-20260925d`), master pushed, tree clean except the owner's
  untracked files (DOC_TTS_2026_9_11.html, DOC/Research/tabletop_vs_traffic_and_dragons.html, audits/FeatureUsage_*.html,
  testRuns/*, dev/__pycache__). Never stage those; stage explicit files only.
- **Server:** 1.5.3 live on Fly release v47 (deployed 2026-09-24; receipt `DEPLOY_1.5.3_2026-09-24.md` in
  `C:\Users\hannu\Projects\traffic-and-dragons-server`, master == origin). `GEMINI_EXPLICIT_CACHE = "0"` is now pinned in
  fly.toml. The nightly backup runs 06:17 UTC.
- **Suite:** 2327 engine assertions + 62 standalone suites green; applicability 1487/1487 across 145 batteries.
- **Owner's voice setup:** Inworld is the primary TTS (narrator **Selene**); Speechify secondary. Every character sheet
  carries Speechify voice, Inworld voice, Piper backup, a delivery direction (Inworld/OpenAI instruction) and a Speed.
- **Owner's play:** The Necrotic Dungeon (Ammut) and The Village are the live saves; the default save folder is
  `C:\Projects\traffic-and-dragons\Campaigns\<slug>\saves\` (gitignored — look there first).

## What shipped this session (all pushed)

| Ver | What |
|---|---|
| v1.986 | **#449** the boot reconcile fetches the ACTIVE campaign's own row — reload can catch a device up (owner-validated) |
| v1.987 | **#450** whispers are hearsay, half as often (WHISPERS_EVERY 30; distortion demanded; defining moment as a gist) |
| v1.988 | **#452** the summary line's Present names open their sheets (owner-validated) |
| v1.989 | **#386/#370** the companion impulse ask — one engine note every 12 turns, the whisper shape (both rows ◉ again) |
| v1.990 | **#453** every NPC sheet shows and edits the portrait (owner-validated) |
| v1.991–3 | **#454** Speechify emotion: reordered, then proven unsupported by Simba 3 — the control is removed |
| v1.992 | **#455** automatic casting draws Speechify actors from the `_32` bench first |
| v1.994 | **#456** an Inworld voice slot on every sheet + one delivery direction per character (owner-validated) |
| v1.995–7 | **#457** per-character speed: absolute, never a multiplier; 1.1× default only for the unassigned; sheet Tests read at it (owner-validated) |
| — | **#448** the `/thursday` burn ladder (skill + `dev/capture-prompt.js` + `dev/dump-transcript.js`); first run next Thursday |
| — | samples: **The Road to Cinderwing** and **The Princess Is Not In Danger** (both publish-ready, not on the curated shelf) |

Closed and archived this session: #369, #387, #405, #406, #421, #423, #433, #438, #439, #441–#445, #449, #452–#457.

## Next task: #458 — per-line emotion for Inworld

The row holds the full design and Inworld's steering vocabulary; start there. The shape: `[SAY:Name|mood]` (optional
second field, short phrase ≤ 40 chars) → the parser keeps `moods[ix]` in the persisted speaker map beside
`directions`/`rates` (game.js `speakerVoiceMap`) → the cloud grouper (`_geminiGroupUnits`, tts.js) never merges two moods
→ a reader declaring `markups:true` (Inworld only) gets `[mood] ` prefixed to each unit's text → a mood failing the shape
is dropped with a console line. Drift surface (tag table, frozen STATE TAGS doc, strip regex): critical review first,
failing test first, goldens re-baselined deliberately, sabotage-prove the new guard on a scratch copy. Open questions in
the row: narrator moods (`[NARRATE:mood]`?) and inline non-verbals (the strip regex leaves bare bracket words visible —
no until it hides them). The owner wants the narrator given an EXAMPLE LIST (emotions, delivery, `[laugh]` `[sigh]`
`[breathe]` `[clear throat]` `[cough]` `[yawn]`, `[giggle]`).

## Owner validation still owed

- #386/#370: play a dozen turns with Nyla; watch for the ★ toast (initiative) and growth.
- #450: do the next whispers read as rumour, and is one per 30 turns too quiet?
- #451: open the second account (owner-tier); then the #423 live two-account check runs.
- #448: the first `/thursday` run, next week, before the ~19:00 Pacific reset.

## Gotchas learned this session (not in CLAUDE.md)

- **The Bash tool collapses backslashes in `node -e` and heredocs** — every patch went through a script written with the
  Write tool; `\u0027` in a `node -e` one-liner broke twice. Keep doing that.
- **The preview's service worker lags a deploy by one navigation**: unregister the SW and clear caches via
  `javascript_tool` before checking a fresh version (`navigator.serviceWorker.getRegistrations()`, `caches.keys()`).
- **The static preview server stops between turns** — `preview_start {name:"static"}` again before browser checks.
- **Seeding a saved world for browser checks:** `scratchpad/seed441.js` builds a throwaway campaign through the engine's
  own `saveLocal()` into `testRuns/seed441.json`; inject it into localStorage, hide `#api-screen`, call `init()`. Never
  the owner's saves, never signed in. Delete the seed file after.
- **The settings validator caps the MODEL rate at 0.8–1.3** — never write a computed rate into `d.models[id].rate`;
  auditions carry a character's speed as `voices:{rate}` on the queue item.
- **Speechify degrades for the rest of a tests-402 run after its failure groups** — a new group that needs a live
  Speechify read must come before them or use Inworld; the builders' string shapes are pinned in engine-tests instead.
- **`_geminiGroupUnits` groups by voice, direction and rate** — any new per-line channel (the #458 mood) splits there too.
- **Inworld's markups doc is login-gated**; the public list is Runware's guide (recorded in #458).
- **Speechify's Simba 3 ignores `<speechify:style>`** — the Emotion control was removed; do not re-add it.
