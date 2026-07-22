# Traffic and Dragons — Session Handoff (2026-07-22, end of day)

**Deployed:** `v1.424` (APP_VERSION in globals.js) · CACHE `tnd-v3-20260722r` (sw.js) · Piper runtime **r9**
**Tests:** 796 assertions, all green · **Branch:** master, everything committed and pushed, tree clean

`PIPER_RUNTIME_REV` is still **r9** and **no `vendor/piper/*` file changed all session** — every fix
was landed in app code on purpose, to stay clear of the permanent-cache delivery trap that ate
v1.322/v1.323.

Nine versions, v1.416 → v1.424, almost entirely the voice stack. Four bugs closed, one still open —
and the open one is why this page is worth reading carefully, because **I spent most of the day
optimising a variable that the final crumb showed is not causal.** The record of how that was
established is worth more than any of the code.

**Read `DOC/BUGS.md` first.** It is the live record and it is where the reasoning is.
**Fable:** `todo_checkWithFable.md` **entry 6** is written for you and names what to challenge.

---

## ⚠ B9 — the one still open. Read all of this before writing code.

Narration dies mid-passage on iPhone and the tab is killed with no unload event, so the only
evidence that survives is the breadcrumb written before the kill. **Twenty crumbs, seven versions.**

### The headline, from the very last crumb of the session

**The tab died at `pc`=107 with NO disposable realm running at all.** That page's first frame spawn
failed at boot (`piper-frame-fail … did not signal ready within 30s`), so everything ran on the
in-page fallback — `eng:"inpage"` — and the death was indistinguishable from the realm-based ones.

**Twenty crumbs, two entirely different engine architectures, the same band.** The realm/memory
axis — which is what v1.418 through v1.424 was built on — looks **orthogonal to what kills the tab.**
Do not resume that line of work without new evidence pointing back at it.

### The one durable fact

**Death tracks cumulative synths: `pc` = 90–125.** Nothing else predicts it. Read position, session
age, uptime, recycles, resident voice count, engine architecture and **memory** all vary freely
across deaths. ORT linear memory at death spans **301–624 MB**.

### Falsified BY MEASUREMENT — do not re-litigate

1. **The phonemizer.** Flat at 16 MB in the lab *and* the field (`pm:16`, `pmc` tracking `pc`).
2. **The r8 session recycle.** A/B'd: recycle-every-30 tracked recycle-off *to the byte*.
3. **ORT session options**, `enableMemPattern` included — the strong prior. No effect, and the
   options demonstrably reached the runtime.
4. **Input-shape bucketing.** Padding to 32-phoneme buckets still climbed, which also proved the
   growth is downstream of the input shape.
5. **ORT memory magnitude.** Deaths at 301 MB and at 624 MB.
6. **The isolation architecture itself** — see the headline above.

**Voice-model churn is nearly dead too:** three deaths had `vs:0` — zero voice switches in the read
that killed them.

### Three fixes that did not work, and why that matters more than the code

- **v1.418** moved synthesis into a disposable iframe realm. It was ACTIVE in the field
  (`eng:"frame"`) and the tab died anyway — **the respawn never triggered**, because memory never
  reached the 400 MB threshold.
- **v1.420's peak sampler was inert by construction.** `omp` can only differ from `om` if memory can
  *drop*, which requires a working respawn. I should have seen that before shipping it.
- **Then it triggered and never COMPLETED** — `rc:0`, same MB re-reported on every attempt. v1.422
  crumbed the reason and the answer arrived on its first outing: **every failure is stage `spawn`,
  "piper host did not signal ready within 30s".** The replacement realm never starts while the old
  one is alive; the new iframe never even reaches its own `ready` post, which precedes any ORT import.

**v1.424 flipped to destroy-then-build** on that evidence — tear the old realm down, null the
pointers, construct into the freed space; `_piperInitP` guards the resulting no-engine window against
a concurrent second spawn. ⚠ **STILL UNVERIFIED.** The only v1.424 crumb had no realm at all, so
nothing exercised it. A test needs `eng:"frame"` **and** a `realm-respawn` in the same ring.

### ⚠ An instrumentation blind spot still open — fix this before anything else here

`_frameRetryUpgrade`, the between-reads self-heal that recovers from a boot-time frame failure,
**crumbs its SUCCESS but only `console.warn`s its FAILURE.** The last crumb shows no recovery across
four reads, so the retry either never fired or failed silently every time and we cannot tell which.
**This is the exact blindness that hid the respawn failure for six versions.** It is a two-line fix.

### The open question, and the cheapest next experiment

**What accumulates once per `predict()` that is NOT ORT linear memory?** Nothing else is currently
measured.

**Do not start by instrumenting ORT again.** The highest-value discriminator costs nothing to run:
**does a page with narration OFF but the same turn count survive?** That separates "per synth" from
"per turn", and nothing built so far distinguishes them. If it dies with narration off, the whole
Piper line is a red herring and the cause is somewhere in the turn loop.

Other never-instrumented candidates: total page memory rather than ORT's wasm alone, decoded-audio /
AudioBuffer lifetime, OPFS handles — and whether the kill is memory-driven at all rather than CPU or
energy-driven.

### What NOT to do

Do not tune `PIPER_RESPAWN_MB` — it targets a variable measured not to be causal. Do not remove the
realm: it works, costs little, and is the only thing that CAN reclaim if something re-implicates
memory. Do not flip the respawn ordering back; there is a sabotage-proven tripwire against it.

---

## ✅ B10 — root-caused and field-confirmed (v1.421)

Two user observations cracked what four report arrivals and nine investigator agents could not: the
downgrade toast fires **before the first word** of a read, and **tapping never restored audio — only
a voice toggle off/on did.**

**`_ensureCtx` replaces the AudioContext only when its state is `"closed"`, and an iOS-interrupted
context is not closed.** So it handed the same dead object back to every recovery path — the
tap-unlock, the 2 s `_armCtxWatch` poll, `visibilitychange`, the `_ctxRunning` gate — each of which
called `resume()` on it. **iOS never hands an interrupted context back; `resume()` rejects forever.**
That refusal loop, retried every two seconds, *is* B10's reported error.

`recoverAudio` automates the voice toggle (close → rebuild → re-prime), wired to the tap-unlock and
to `sendAction`. **User-confirmed: a tap now restores the voice with no toggle.**

⚠ **Residual:** the interrupt can land *during* the GM call, after the send-gesture repair, so the
first line of that read still degrades to native. The failure moved from "audio stays broken until
you toggle" to "you lose one line, then any tap fixes it". **Do not try to repair at read start** —
a context built outside a gesture is born suspended and `resume()` outside a gesture is refused
(the v1.327 scenario). Cheapest direction: keep the recovery listener armed persistently while voice
is on, so any incidental touch during the GM call repairs it first.

**Bonus evidence:** the toast plays a sound through `sound.js`'s *separate* AudioContext — one
context producing audio while tts.js's was interrupted. The device was never the problem. That
retires the device-unavailable / media-daemon family permanently.

---

## ✅ Also closed this session

**The voice ✕ button never deleted anything** (v1.420, now field-confirmed working). The vendored
`remove()` uses `FileSystemFileHandle.remove()` — Chrome-only — inside a catch that only
`console.error`s, so on Safari every delete was a no-op that toasted success. It had also
permanently disabled the 10-voice cap: eviction believed the removal, dropped the LRU stamp, and an
unstamped id sorts *oldest*, so the next eviction re-picked the same phantom forever. That is how 13
voices (~1 GB) accumulated. Fixed **locally in tts.js** with the standard `removeEntry()`, which
throws. Automatic eviction now refuses to delete an assigned or narrator voice; manual ✕ stays
unrestricted (user call).

**B16 — a GM turn lost to a network failure** (v1.419). The typed action comes back on failure;
turn-start/turn-fail crumbs record in-flight time and backgrounding; Car Mode makes a **sound** when
a turn fails. The transport retry was deliberately NOT shipped — "Load failed" can occur *after* the
request reached the provider, so a blind retry risks double billing and two server-side turns.

**B14 — speaker voicing: VERIFIED and closed.** Four rounds. The fix that held was the user's own
insight that one segmentation was doing two jobs — commas segment for **rhythm**, quotes for
**voice**. Invariant for anyone touching the splitter: **pause boundaries must be a SUPERSET of
voice boundaries**, and storage stays unit-indexed NAMES resolved at speak time.

**Markdown emphasis was being spoken aloud** (v1.423) — "asterisk, the text is italic, asterisk".
`escProse` stripped it for display all along; `normalizeForTTS` never did. ⚠ **Side effect:** the
markers were also shifting unit boundaries, so speaker maps stored **before v1.423** for passages
containing emphasis now fail their `sp.n` fuse and replay in a single voice. That is the fuse working
correctly, not a regression.

---

## Open rows

**B16** `fixed`, awaiting field · **B13** `new` — prose comprehension, engine state was clean ·
**B15** `new` — credit exhaustion surfacing as a summarize crash; the balance is topped up, so the
failure *surface* is the filed issue · **B11** `findings-ready` — `summarize()` throws on a tag-only
extractor response; **drift surface, Fable-tier if acted on**.

**TODO #87** — the phonemizer reuse latch fails open into the v1.323 leak, permanently and silently,
with no reset. Found in a lab (27 modules in a 100-synth soak); **blocked on evidence**, and the
field has said `pn:1` on every crumb, i.e. it has never fired in play.

---

## Gotchas — these cost real time today

- **⚠ `npx serve` caches files in memory.** It served a stale `tts.js` (133,848 bytes vs 139,815 on
  disk) for about an hour, so several "the fix didn't work" readings were testing old code. Caught
  only by fetching the file and diffing its length. **Restart the preview server after edits.**
- **⚠ Chrome freezes backgrounded preview tabs** hard enough that an iframe's own script never runs
  and its `setTimeout` never fires. An unattended soak measures almost nothing.
- **⚠ Worktree isolation is broken here** — it tries to `mkdir .claude/worktrees`, which already
  exists, and fails every time. Parallel agents therefore need disjoint **file** ownership, not just
  disjoint functions.
- **⚠⚠ `node -e` from bash eats backticks — this bit me THREE times today**, twice needing repair
  commits, despite already being in the previous handoff. **Patch scripts for docs go in a FILE.**
  No exceptions, however short the edit looks.
- **Sabotage-test every guard, and have the sabotage script assert its own target exists.** One
  sabotage silently changed nothing and "passed" — a false all-clear. Another tripwire
  false-positived on the fix's own comment, which quoted the bad call it replaced.
- **Verify the thing that SHIPS, not a simplified version of it.** Every desktop respawn test
  unregistered the service worker and ran without memory pressure — and the *first* realm starts
  fine on the phone too. What I verified was single-realm spawning; what ships is a second realm
  alongside a loaded one. That gap is why v1.418–v1.422 never worked.
- **⭐ The biggest one: check that the variable you are optimising is causal BEFORE building on it.**
  Six versions went into isolating and recycling ORT memory. The final crumb showed the tab dying
  identically with no realm at all. The instrumentation was worth it — it is what proved the
  negative — but four of those versions were fixes for something that was never the cause.

---

## Awaiting the user

1. **Nothing is blocked.** Play when you like.
2. The next crumb is only decisive for B9 if it carries **`eng:"frame"` plus a `realm-respawn`** —
   that is the one combination that tests v1.424.
3. B10's residual, TODO #87, and the `_frameRetryUpgrade` crumb gap all have documented directions.
