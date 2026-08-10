# AUDIT — The clock phase-mismatch detector (TODO #158, v1.584)

**TLDR: the engine can now notice a time-of-day that exists only in narration — the t1605 class ("dusk" written against an 11:10 am clock) arms a one-shot GM-decides reconcile nudge; the recognizer shipped only after the 328-turn corpus audit came down to exactly one alert, the true positive, with every corpus false alarm converted into a named guard and test.**

- **Date:** 2026-08-09 · **Version:** v1.584 · **Spec:** the #158 row as amended by the adjudicated Sol design review (all seven points).
- **Order of work:** failing tests (6 red) → implementation → corpus audit → three hardenings (failing-first each) → sabotage (10/10, after fixing what it exposed) → docs.

---

## 1. What shipped

- **`clockPhaseAssertion(cleanProse)`** (clock.js) — the recognition contract: `TIME_PHASES_PROSE` are `\b`-anchored derivations of `TIME_PHASES` (one vocabulary, two compiled shapes — the label regexes match "Morningstar"/"knight" raw); odd straight-quote parity (or curly mismatch) distrusts the whole entry; **any quote character in a sentence marks it speech territory**; sentences with future/modal, historical, figurative, negated, vision/memory, speech-verb, or interrogative markers reject whole; a `this/that <phase>` pre-window rejects the candidate; overlaps resolve by registry specificity; the **last qualifying cue** wins.
- **`clockPhaseBandDist(idx)`** — circular distance to the phase's `[b0,b1)` **band** against the post-`applyMuts` clock: in-band agreement self-silences whatever tags fired, and a `[TIME:morning]` tag under dusk narration is a **contradiction** that still measures far (the review's sharpest amendment — no covering-tag suppression).
- **`clockPhaseDetect(clean)`** — arms `worldState.phaseMismatch` at ≥ `PHASE_MISMATCH_MIN` (240m, globals). Never moves the clock.
- **`buildPhaseMismatchNudge`** (api.js) — one-shot, combat-silent without consuming, stale-agreement discards silently, latch in `NOTE_LATCH_FIELDS` (the #151 registry contract enforces the declaration). Phrasing per the review: *"If the story is NOW at \<phase\>, emit `[TIME:<phase>]` … If that mention was only a reference (a plan, a memory, a figure of speech), do nothing."*
- **Seams:** `commitGmTurn` immediately after `applyMuts`, on CLEAN prose (raw would match the tags' own words; sheet-sync/TT never pass through) — and `rerollLast`, where replacement narration applies **no tags at all**, so the nudge is the only possible heal. Both pinned by the #158 wiring source contract (which also pins the prose forms staying *derived* from `TIME_PHASES`).

## 2. The enable gate — corpus precision (dev/clock-phase-audit.js)

Replaying the shipped recognizer over the **328 clock-stamped GM turns** of the t1593 save, each against its own historical `ck` clock:

| Build | Assertions recognized | Alerts ≥4h | Verdict |
|---|---|---|---|
| Reviewer's rough literal scan | — | 10 | mixed true/false (the baseline) |
| First shipped recognizer | 26 | 4 | 1 true + 3 semantic false alarms |
| After the three hardenings | 18 | **1** | **the true positive only** |

The surviving alert is t1366 — *"Morning comes grey and cold through the bathhouse shutters"* against **Day 4, 4:10 pm** — a genuine historical desync of exactly the class the detector exists for. The three eliminated false alarms each became a named guard **with its own failing-first test**:

- **t1412** — *"Dawn, then," you say* — a spoken plan that leaked because the entry's 25 straight quotes (odd) mispaired the stripper. → the **parity guard**, and ultimately the simplification below.
- **t1413** — *"gone to finish it, back by first light"* — the return-plan idiom. → `back by` joined the rejection list.
- **t1586** — *"Whatever this afternoon was, it's over now."* — retrospective reference. → the `this/that <phase>` candidate guard.

## 3. What the sabotage discipline caught (and changed)

The first sabotage run (11 cases) MISSED four — each miss a real finding:

1. **The quote-stripper was redundant machinery.** With the residual-quote and parity guards in place, removing the balanced-pair stripper changed nothing the suite could see — because the guards had collapsed into a simpler rule: *any sentence containing a quote character is never trusted*. Shipped simplified (stripper and blank-run guard deleted); a quoted-phase-without-speech-verb case (`"Dusk. Move." The word hangs there.`) now pins the surviving rule alone.
2. **My even-parity "t1412 replica" proved the mispair class exists at balanced counts too** — an unclosed opener flips subsequent quote roles while the total stays even. The any-quote rule subsumes this; the replica test remains.
3. **A band-dist sabotage silently hit the wrong function** — `clockReconcilePhase` contains the byte-identical in-band early-return, and `indexOf` found it first. The find was made unique. **Filed observation:** the reconcile's own in-band early-return has no test pinning it (the suite stayed green with it removed) — candidate for a future coverage pass, not this change.
4. **The hook sabotages defeated my own wiring contract** — replacing the call with `if(false)clockPhaseDetect(clean)` left the substring the contract greps for. The sabotage now excises the call text; the contract catches both seams.

Final: **10/10 caught, files restored byte-identical.**

## 4. Verification summary

6 failing-first engine tests + 14 rejection sentences (every corpus false-alarm class + the review's semantic set) → **ALL GREEN, 1195 assertions** · sabotage 10/10 · diff-replay 5/5 corpora byte-identical (the detector lives at the commit seam, outside the replay path — verified by bytes, not just by construction) · the #151 latch-registry contract enforces the `phaseMismatch` declaration structurally.

## 5. Field expectations

At the corpus rate, the nudge should fire roughly once per few hundred turns — and when it does, it is worth reading. If it ever feels chatty, the tuning order is: raise `PHASE_MISMATCH_MIN`, then extend the rejection list from real transcripts via `dev/clock-phase-audit.js` — never loosen toward guessing. The t1605 live desync itself still wants its one-line in-story heal ("it is dusk now") if not already applied; go-forward, the detector would have caught it one turn later.
