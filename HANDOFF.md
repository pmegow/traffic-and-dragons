# Traffic and Dragons — Session Handoff (2026-07-22, late)

**Deployed:** `v1.421` (APP_VERSION in globals.js) · CACHE `tnd-v3-20260722o` (sw.js) · Piper runtime **r9**
**Tests:** 794 assertions, all green · **Branch:** master, everything committed and pushed, tree clean

`PIPER_RUNTIME_REV` is still **r9** and no `vendor/piper/*` file changed this session — every fix
below was landed in app code on purpose, to stay clear of the permanent-cache delivery trap.

This session was almost entirely **the voice stack**, and it went further than expected: B10 and
the voice-cap bug are both root-caused and fixed, B14 is closed, B16 is new-and-fixed — and **B9's
fix did not work**, which is the most important thing on this page.

Read `DOC/BUGS.md` first. It is the live record and it is where the reasoning is.

---

## ⚠ Pick this up first: B9, and read this before touching it

**The v1.418 fix shipped, was ACTIVE, and the tab died anyway.** The crumb says so without
ambiguity: `app:v1.418, eng:"frame", pc:120, rc:0, om:308`.

`eng:"frame"` means the disposable iframe realm was running. `rc:0` with `om:308` against a 400MB
threshold means **the respawn never fired** — the fix was correctly built, correctly active, and
never had cause to do anything. The tab died at `pc`=120, dead centre of a band now spanning nine
crumbs and four app versions (124/103/96/119/118/118/114/121/120).

**So the model the fix was built on is falsified.** The lab measured 611MB by 100 synths; the phone
reports 308MB at ~111. My varied-shape harness swept 60 distinct word-counts, which manufactures
far more distinct input shapes than real prose does — so the per-shape ratchet is real (measured
three separate ways) but its FIELD magnitude is roughly half the lab figure and **never reaches a
lethal level. ORT steady-state linear memory is not what kills the tab.**

**Do not tune `PIPER_RESPAWN_MB`.** Lowering it would make the fix fire against a variable that is
not causing the death. Do not rip the realm out either — it works, costs little, and is the only
thing that can reclaim memory if peak-side evidence later implicates ORT after all.

**What is now instrumented and was not before (v1.420):** ORT memory is sampled **per unit inside
the read**, and a page high-water mark rides the crumb as **`omp`**. The old `om` was a
between-reads floor, which is why a page being killed could report a placid 308MB. iOS jetsam
responds to peak. **The next crash crumb carries the first peak measurement this bug has ever
produced** — that is the next real evidence, and there is nothing useful to do before it arrives.

**Current leading candidate: voice-model churn.** `nv:13` distinct voices in that page load, and
the fatal read was the most speaker-dense of the session (`map18` vs 3-5 on earlier reads).
`tndGetSession` is single-slot and creates the new session BEFORE releasing the old, so every voice
switch re-reads a 60-130MB model with the previous still resident — large transients inside one
read, invisible to a steady-state number. The user can now delete surplus voices (see below), which
makes "does it die less with fewer resident voices?" a cheap field experiment.

**Ruled out by measurement, not argument** — do not re-litigate these: the phonemizer (flat at 16MB
in lab AND field, `pm:16` at `pmc:121`), the r8 session recycle (identical curves to the byte), ORT
session options including `enableMemPattern` (no effect), and input-shape bucketing (still climbed,
which also proved the driver is downstream of the input shape).

---

## ✅ B10 — root-caused and FIXED (v1.421), awaiting one confirmation

Two user observations cracked what four report arrivals and nine investigator agents could not:
**the downgrade toast fires BEFORE the first word of a read**, and **tapping never restores audio —
only a voice toggle off/on does.**

**The mechanism is structural.** `_ensureCtx` replaces the AudioContext only when its state is
`"closed"`, and an iOS-**interrupted** context is not closed. So it handed the same dead object back
to every recovery path in the file — the tap-unlock, the 2 s `_armCtxWatch` poll, `visibilitychange`
and the `_ctxRunning` gate — each of which called `resume()` on it. **iOS never hands an interrupted
context back; `resume()` rejects on it forever.** That refusal loop, retried every two seconds, IS
B10's reported error. Not a device fault, not the media daemon, not `sound.js`.

Nothing noticed between turns because `_armCtxWatch` **disarms itself** whenever nothing is playing,
`visibilitychange` needs a tab switch a notification never produces, and `_armCtxUnlock` is reactive
— armed only after a read already failed, so by construction it can never save the line that
discovers the problem.

**The fix** (`recoverAudio`) automates the voice toggle, which is the only recovery with field
evidence behind it: close, rebuild, re-prime. Wired to the tap-unlock **and to `sendAction`** — the
send tap is a real user gesture landing seconds before narration, so it repairs the context ahead of
the read instead of after the first line is already lost.

**Awaiting:** a single tap should now restore the narrator voice with no toggle. If the toggle is
still needed, the rebuild is not landing in the gesture.

---

## ✅ Also fixed this session

**The voice ✕ button never deleted anything** — field-confirmed and now field-confirmed working
(v1.420). The vendored `remove()` uses `FileSystemFileHandle.remove()`, a Chrome-only extension, in
a `catch` that only `console.error`s — so on Safari every delete was a no-op that toasted success.
It also permanently disabled the 10-voice cap: eviction believed the removal, dropped the LRU stamp,
and an unstamped id sorts oldest, so the next eviction re-picked the same phantom forever. That is
how 13 voices (~1GB) accumulated. Fixed **locally in tts.js** with the standard `removeEntry()`,
which throws. Automatic eviction now also refuses to delete an assigned or narrator voice (user call
— manual ✕ stays unrestricted).

**B16 — a GM turn lost to a network failure** (v1.419): the typed action is handed back on failure,
turn-start/turn-fail crumbs record in-flight time and backgrounding, and Car Mode finally makes a
**sound** when a turn fails. The transport retry was deliberately NOT shipped — "Load failed" can
occur after the request reached the provider, so a blind retry risks double billing.

**B14 — speaker voicing: VERIFIED and closed.** Four rounds; the fix that held was the user's own
insight that one segmentation was doing two jobs (commas segment for rhythm, quotes for voice).
Invariant for anyone touching the splitter: **pause boundaries must be a SUPERSET of voice
boundaries**, and storage stays unit-indexed NAMES resolved at speak time.

---

## Open rows

**B16** `fixed` (awaiting field) · **B13** `new` — prose comprehension, engine state was clean ·
**B15** `new` — credit exhaustion surfacing as a summarize crash; balance topped up, so the failure
*surface* is the filed issue · **B11** `findings-ready` — `summarize()` throws on a tag-only
extractor response; **drift surface, Fable-tier if acted on**.

**TODO #87** (new) — the phonemizer reuse latch fails open into the v1.323 leak, permanently and
silently, with no reset. Found in a lab (27 modules in a 100-synth soak); **blocked on evidence**,
since the trigger is unproven on real prose. The crumb now carries `pn`, which decides it. Field
value so far has been `pn:1`, i.e. it has NOT fired in play.

---

## Gotchas learned this session — these cost real time

- **⚠ `npx serve` caches files in memory.** It served a stale `tts.js` (133,848 bytes vs 139,815 on
  disk) for about an hour, so several "the fix didn't work" readings were testing old code. Caught
  only by fetching the file and diffing its length. **Restart the preview server after edits.**
- **⚠ Chrome freezes backgrounded preview tabs** — hard enough that an iframe's own script never
  runs and its `setTimeout` never fires. An unattended soak measures almost nothing (2 synths in 3
  minutes vs ~3.6 s/synth fronted). Keep the tab fronted or poll it awake.
- **⚠ Worktree isolation is broken in this repo** — it tries to `mkdir .claude/worktrees`, which
  already exists, and fails every time. Parallel agents therefore need disjoint **file** ownership,
  not just disjoint functions. Nearly all voice work lives in `tts.js`, so it does not parallelise
  into more than one writer; the third lane was a read-only investigator whose output was applied by
  hand.
- **⚠ `node -e` from bash eats backticks** — it command-substituted every backticked identifier and
  gutted a tracker entry, needing a repair commit. This is already in the previous handoff and it
  still happened. **Patch scripts for docs go in a FILE.**
- **Sabotage-test every guard.** The first voice-delete tripwire false-positived on the fix's own
  comment (which quotes the bad call it replaced). It was only caught because the guard itself was
  sabotage-tested rather than trusted.

---

## Awaiting the user

1. **The B10 toast** — one tap should restore the narrator voice without a toggle.
2. **A crash crumb carrying `omp`** — the first peak memory reading, and the only thing that moves
   B9 forward.
3. **Optional cheap experiment:** delete surplus voices and see whether narration deaths thin out.
   That tests the voice-churn hypothesis at the cost of a few taps.
