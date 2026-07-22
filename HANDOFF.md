# Traffic and Dragons — Session Handoff (2026-07-22, late)

> Updated after a further sync: B9's fix is now known to have NEVER completed, and ORT memory is
> measured NOT to be the predictor. The B9 section below is rewritten accordingly — it is the part
> that changed most.

**Deployed:** `v1.422` (APP_VERSION in globals.js) · CACHE `tnd-v3-20260722p` (sw.js) · Piper runtime **r9**
**Tests:** 794 assertions, all green · **Branch:** master, everything committed and pushed, tree clean

`PIPER_RUNTIME_REV` is still **r9** and no `vendor/piper/*` file changed this session — every fix
below was landed in app code on purpose, to stay clear of the permanent-cache delivery trap.

This session was almost entirely **the voice stack**, and it went further than expected: B10 and
the voice-cap bug are both root-caused and fixed, B14 is closed, B16 is new-and-fixed — and **B9's
fix did not work**, which is the most important thing on this page.

Read `DOC/BUGS.md` first. It is the live record and it is where the reasoning is.

---

## ⚠ Pick this up first: B9 — and read this whole section before writing code

**Twelve crumbs, six app versions, and the fix I shipped has never once worked.** Two separate
reasons, both now measured:

**① The respawn never completes.** The ring shows it triggering three and four times per session
with memory never moving — `realm-respawn 527MB after 44 / after 75 / after 100`, the same figure
each time — and `rc:0` on every report proves it: the counter only increments after a successful
swap. So the trigger fires, the swap fails, the `catch` keeps the old frame, and the failure went
to a console no phone has. **v1.422 fixes the blindness, not the bug**: a `respawn-fail` crumb now
carries the STAGE (`spawn`/`init`/`warm`/`swap`), the reason, and the memory at attempt time, plus
a per-page count as `rf` on the death crumb.
**Read the stage first.** `spawn` means the new realm never signalled ready — i.e. the phone could
not afford a second ORT alongside the old one (~700MB at report 0's numbers), which would indict
the build-then-destroy ordering. That ordering was chosen for safety, and under memory pressure it
may be exactly backwards; destroy-then-build, with its brief no-engine window, might be the only
order that can succeed when it is actually needed. **Do not flip it on a hunch — wait for the
stage.**

**② ORT memory is NOT the predictor, and this is the bigger finding.** Deaths at `pc` = 104 / 125 /
105 with ORT at **527 / 433 / 301 MB** — a 226MB spread at the same outcome, one of them below the
respawn threshold and below what other sessions survived. Across all twelve crumbs `pc` sits in
**96-125** while memory at death ranges 301-527MB. **Death tracks cumulative synths. It does not
track ORT linear memory.**

**Five hypotheses are now falsified by measurement, not argument. Do not re-litigate them:** the
phonemizer (flat at 16MB in lab AND field, `pm:16` with `pmc` tracking `pc` exactly), the r8
session recycle (identical curves to the byte), ORT session options incl. `enableMemPattern` (no
effect), input-shape bucketing (still climbed — which also proved the driver is downstream of the
input shape), and now ORT memory magnitude itself.

**⚠ Also falsified: my own peak sampler.** `omp` equals `om` necessarily, because ORT memory only
grows — a high-water mark can differ from the current value only if the value can drop, which
happens solely on a successful respawn. v1.420's headline instrument is inert until ① is fixed. I
should have seen that before shipping it.

**The open question, stated honestly: what accumulates once per `predict()` that is NOT ORT linear
memory?** We currently measure nothing else. Worth instrumenting before guessing — total page
memory rather than just ORT's wasm, decoded-audio/AudioBuffer lifetime, OPFS handles — and worth
asking whether the kill is memory-driven at all rather than CPU/energy-driven. `nv` spanning 3 to
12 across three deaths (one at `pc`=105 with only THREE resident voices) also weakens voice-model
churn as a sole cause, though it may still amplify.

**What NOT to do:** tune `PIPER_RESPAWN_MB` (it targets a variable now measured not to be causal),
or remove the realm (it works, costs little, and is the only thing that could reclaim if something
re-implicates memory).

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
