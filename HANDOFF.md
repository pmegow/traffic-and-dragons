# Traffic and Dragons — Session Handoff (2026-07-22)

**Deployed:** `v1.415` (APP_VERSION in globals.js) · CACHE `tnd-v3-20260722i` (sw.js) · Piper runtime `r9`
**Tests:** 784 assertions, all green · **Branch:** master, everything committed and pushed, tree clean

This session was almost entirely **field-bug work on the voice stack**. TODO #9's build finished
early on; the rest was chasing what real play surfaced. Read `DOC/BUGS.md` first — it is the live
record and it is where the thinking is.

⚠ **A parallel session shares this working tree.** It closed TODO #84 (LiveKit) while this one was
running — see below. Stage files EXPLICITLY, never `git add -A`.

---

## ⚠ Pick this up first: B9 — the narration ratchet

The one genuinely unsolved problem, and the most valuable thing on the board.

**What is established, from seven field crumbs:** Piper narration dies mid-read on iPhone and the
tab is killed. The controlling variable is **cumulative synths since page load** — `pc` at death
across all seven: **124 / 103 / 96 / 119 / 118 / 118 / 114**. Read position (14%–97%), session age
(`ps` 7–34), recycles (`rc` 2–3), resident voices (`nv` 4–5) and uptime (5–20 min) all vary widely
and none of them predict it.

**What is ruled OUT, by measurement not argument:**
- **The phonemizer.** This was the leading hypothesis from a 9-agent investigation and from me.
  r9 added `tndDiag()` to the vendored runtime; driven straight at `mod.predict()`, its wasm linear
  memory is **flat at 16 MB across 36 consecutive `callMain` re-entries**. It does not accumulate.
  The r8 author had already rejected recycling it in a code comment, and was right.
- **Read position, session age, voice count** — see above.
- **The ORT session recycle** helps not at all: deaths occur with `rc`=2–3 behind them.

**The remaining candidate:** ORT's own runtime linear memory, which is NOT the InferenceSession that
`tndRecycleSession` releases. Releasing a session cannot shrink wasm memory that already grew, which
would explain precisely why the recycle fires and changes nothing.

**⛔ The blocker, and the discipline to keep:** ORT's memory is **not observable yet**. Two attempts
failed — hooking `WebAssembly.Memory` caught zero (these modules declare memory internally rather
than importing it), and hooking `instantiate`/`instantiateStreaming` also caught zero. **Do not
patch blind.** That is exactly the trap the r8 comment documents, and it is what falsifying the
phonemizer hypothesis just saved us from. Next things to try: hook the synchronous
`WebAssembly.Instance` constructor; instrument inside `piper_test.html` (now on r9); or run
cross-origin-isolated and use `performance.measureUserAgentSpecificMemory()`.

**A fix has a falsifiable acceptance test now**, which this class never had: carry `pc` past ~130
without dying, with read length and voice count varied. No memory graph needed — which is as well,
since iOS Safari exposes none.

**Field data is exhausted for diagnosis.** Seven crumbs, one constant, every competing variable
ruled out by variation. The next useful evidence comes from a fix attempt or a better probe.

---

## The other open bugs

**B10 — `Failed to start the audio device`** (`findings-ready`). Emitter **named** by the v1.407
observer: caller tag `ctx-watch`, context state `interrupted`, `InvalidStateError`. It is tts.js's
own context via `_armCtxWatch`'s 2 s poll — **not** `sound.js`, which was my leading hypothesis and
was wrong. Severity dropped sharply: two independent observations show narration continuing fine
after it fires (one page did 96 synths over 20 min after a refusal). The user-visible "audio died"
belongs to B9 plus the latched-`_playing` wedge, both cleared by a voice toggle.
⚠ **The emails have STOPPED by design** — v1.407 attaches a handler, so the rejection no longer
reaches `unhandledrejection`. Absence of B10 mail is NOT evidence the condition ended. Watch the
breadcrumb ring.

**B11 — `summarize()` throws on a tag-only extractor response** (`findings-ready`). The throw and
"survived with no memory loss" are root-caused. Why the extractor answered in state tags is
probable-not-proven: engine notes are archived into `sessionLog`'s user halves and replayed verbatim
into the extraction window, where the 500-char slice on a quest-escalation turn is 100% engine
imperative ending in "emit `[QUEST_STEP:]`". **Drift surface — Fable-tier if acted on.**

**B13** (`new`) — prose comprehension; engine state was clean. **B15** (`new`) — credit exhaustion
surfacing as a summarize crash; the balance is topped up so it is not urgent, but the failure
*surface* is the filed issue. **B12** — ignored, with a recorded reopen trigger. **B14** — see below.

---

## B14 — speaker voicing (fixed across three rounds, awaiting your ear)

`Status: fixed`, not yet `verified`. The user confirmed the first round by ear; the third round is
unconfirmed.

The arc is worth understanding because the final architecture came from the user, not from me:

1. **v1.408** — the comma split cut between a comma and its closing quote, so the attribution unit
   began with a quote mark and read as speech. Reattached the quote, parity-guarded.
2. **v1.409** — the user's insight: *one segmentation was doing two jobs.* Commas segment for
   **rhythm**, quotes segment for **voice**, and the voice layer had been inheriting whatever
   boundaries prosody happened to produce. `splitSentences` now tags each unit with its dialogue
   span; voices key off spans.
3. **v1.410** — field-reported residual. Two more defects, both mine: a unit could **straddle** a
   quote boundary (the split only breaks at `, ; : . ! ?`), and I had **removed the evidence the
   model needs** by showing it only extracted quoted spans — so `said Ammut` was stripped out and it
   was identifying speakers from speech alone. Now the whole passage is shown with spans **marked**
   (`[[0]]`). Also fixed: quote parity leaked across paragraph breaks, inverting continued speech.

**Invariant to preserve:** *pause boundaries must be a SUPERSET of voice boundaries.*
**Storage:** unit-indexed `sp:{n, s:{unitIndex: NAME}}` on the transcript entry. **Names**, not voice
ids — they resolve at speak time so rebinding a character re-voices past turns. `n` is a staleness
fuse.

**Still wanted:** a listen on a **long multi-paragraph speech** — the parity fix is unverified in
the field. If it misbehaves, just file it with ⚠ Report bug: since v1.412 the report carries the
line-by-line speaker map, so it is diagnosable without you describing what you heard.

---

## Shipped this session (v1.403 → v1.415)

| Version | What |
|---|---|
| v1.403 | Cartesia dead-code sweep — 315 lines, 71 grep hits → 0 |
| v1.404 | Blueprint-authored narrator voice (`narratorVoice`, E20 no-clobber rule) |
| v1.405 | Retired `ENGINE_K`/`NATIVE_K`/`isNative` — two dead generations of engine selection |
| v1.406 | **#9 ⑤ LLM speaker post-pass** — the last piece of the voice rework |
| v1.407 | **#16c diagnostics** — session id, breadcrumb ring, enriched crumb, resume-rejection tags |
| v1.408–410 | B14, three rounds (see above) |
| v1.411 | r9 phonemizer measurement — hypothesis falsified, no fix shipped |
| v1.412 | Speaker map carried in voice bug reports |
| v1.413 | `Explosives` skill (Craft, INT/DEX) — SKILLS 36 → 37 |
| v1.414 | Panel-toggle scroll pin (user-confirmed working) |
| v1.415 | Phonemizer memory moved into the crumb |

**#16c is the session's most reusable idea.** A process kill runs no handler, so the only evidence
that survives is what was written down first. The breadcrumb ring generalises the Piper crumb: a
bounded, localStorage-persisted event log recovered at the next boot, so a crash report carries the
seconds *before* the kill. It broke B9's confound and named B10's emitter within one play session.
Everything rides in `detail` — the GAS sheet is a fixed 15-column schema in a user-deployed script,
so new columns would mean a redeploy.

---

## TODO state

- **#9** — reformatted from one 16,016-char cell into 16 paragraphs (`<br><br>`; content verified
  byte-identical). Gendering folded in as **⑨** (voices need a gender attribute — `PIPER_VOICES`
  states gender only in the label string, `tts.js` never mentions it). Remaining in #9: the
  gendering, ⑦ multi-speaker (904 speakers in the download already on the device), ⑧ custom sample
  text. **Do ⑨ with ⑦, not twice.**
- **#84 LiveKit — CLOSED as declined by a PARALLEL SESSION** (commit `3a2c5bf`, report in
  `DOC/liveKit_findings.html`). It also touched CLAUDE.md. Not my work; read it before acting on
  anything audio-transport-shaped.
- **#86 — rework the TODO format** (new). Two problems named apart: no subtasks, and no paragraphs.
  The likely biggest win for least work is moving the shipped-version history out to a changelog so
  a task describes only what is LEFT — decide that before designing subtasks.
- **#85** — deliberately left as a gap; its content moved into #9 ⑨.

---

## Conventions and gotchas learned this session

- **`<N` at the start of a message = reply in N words or fewer.** Saved to memory
  (`brevity-notation`); it overrides the version-line and action-required defaults.
- **⚠ Never use `node -e "…"` for docs containing backticks.** Bash command-substitutes them and
  silently eats the content — it garbled a BUGS.md note badly enough to need a repair commit. Write
  a patch script to a scratch file and run it. This bit me four or five times.
- **TODO rows must be ONE physical line** (`dev/lint-todo.js` guards it — a raw newline strands
  every row below). `<br>` is the sanctioned break, and the linter's own error says so.
- **`piper_test.html`'s import rev must match `PIPER_RUNTIME_REV`** — the suite has a `SOAK REV LAG`
  tripwire that caught the harness about to soak the *old* runtime.
- **Only `vendor/piper/*` edits need a `PIPER_RUNTIME_REV` bump.** I wrongly told the user v1.415
  would need r10; `tndDiag` already shipped in r9, so it was tts.js-only.
- **Crash reports are mailed at the NEXT BOOT**, so `TTS.diag()` necessarily reads an empty engine.
  That is why the phonemizer figure had to move into the crumb.
- The preview browser could **not** reproduce the `.rpanel` resize at any viewport (`min-width:auto`
  floors it at content width). Unconfirmed whether that is a real bug or my synthetic fixture —
  recorded as an observation, not a finding.
- Screenshot capture times out in this harness; the page stays responsive. Use `read_page` / JS.

---

## Awaiting the user

1. **A listen on a long multi-paragraph speech** (B14 round 3, unverified).
2. **Do UI earcons play?** One yes/no closes the last `sound.js` question on B10.
3. **Next build pick.** My recommendation: make ORT memory observable (B9), since everything else on
   that bug is done and a fix without it is a guess.
