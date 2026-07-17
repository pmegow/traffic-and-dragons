# Arc-nudge loop — evaluator notes (Fable)

Running verdicts per trial. Final synthesis goes to the AUDIT doc; this file is working state.

## A1 — scenario A (budget-nudge obedience) · 10 turns t344–t353 · $1.045

**Nudge state:** deterministically live every turn (Thistletop active, startTurn=283 → 61–70
turns over the 50-turn budget; single active arc; no combat at any snapshot).

**Result: COMPLIANT CONVERGENCE, NO PREMATURE CLOSE — provisional PASS.**

- `[ARC_COMPLETE:]` NOT emitted — and correctly so. The fiction's arc climax (the reservoir
  dispersal sequence needing a willing conductor at the terminus stone) had not yet occurred;
  closing inside these 10 turns would have been exactly the premature close the user fears.
  The nudge's anti-railroad parenthetical held under 10 consecutive turns of pressure.
- **Convergence is strong and measurable:** all 10 turns drive a straight line at the arc
  objective — locate Aldus (t344), assess (t345–348), extract (t349), acquire the arc-climax
  procedure (t350–352: drain mechanics, conductor requirement, Daeris foreshadowed), caretaker
  context (t353). **Zero new named NPCs, zero new locations, zero new threads** — the t727
  metastasis signature (self-replicating sub-objectives) is completely absent.
- Suggestion buttons (same model, same nudged prompt) never proposed sprawl — the suggestion
  surface is converging too.
- Attribution caveat: cannot yet separate "nudge-driven" from "story was converging anyway" —
  that is scenario D's job.

**Ecosystem side-findings (bonus evidence, all good):**
- Quest-escalation engine note (P3) obeyed exactly at t344: `[QUEST:Aldus Vareth|completed]`
  + step-complete + `[XP:300]` in the same response, as instructed.
- Condition-audit note obeyed at t344: 3 stale conditions removed (Bloodied Nose; Daeris
  Unconscious + Traumatized).
- Prior-session player retcon ("Nualia is dead... Corven didn't hire us") respected throughout —
  t351 narration says "Found us. Hired us" — wait, CHECK: t351 player line says "Hired us to
  find you" and Frizwick corrects "Insisted" — the GM handled the hired/asked correction with
  an in-fiction wink. Acceptable; not a drift regression.

**Cost calibration:** $0.1045/turn (turn calls $0.055 + actions $0.044 + summarize amortized).
Full matrix ≈ $11.5 → inside the $25 cap. Actions-call cache reads visible (cacheRead +35k on
the actions bucket mid-run) — v1.288 cache-riding is working in the wild.

## B1 — scenario B (drift nudge) · 10 turns t344–t353 · $1.046

**Result: PASS — immediate, fictionally clean close of the genuinely-stale arc.**

- Drift latch written at t343 (`{"The Glassworks|The Glassworks": 343}`) — the nudge fired on
  the first outgoing message; `[ARC_COMPLETE:The Glassworks]` arrived in the response to that
  very message (t344). **One nudge, one close.**
- Close quality (the key judgment): the tag is pure bookkeeping — the narration never leaves the
  live Aldus/terminus-stone scene, no teleport, no recap interlude, no invented Glassworks coda.
  The GM treated the nudge exactly per its wording: story already finished → emit the tag and
  move on. This is the t727 remedy working as designed.
- Engine follow-through: transition handler activated Thistletop with startTurn=344 (fresh
  clock — the v1.296 stamp working live); quest lifecycle continued normally ([QUEST:Aldus
  Vareth|active] t344 → completed t349 +XP).
- Re-fire (+50 turns) not observable in a 10-turn window — deliberately left to the engine tests.
- Instrumentation note: 700-char sent-capture truncated the drift-note text out (quest+condition
  notes filled the budget). Latch write is sufficient proof of firing; injector bumped to 2000
  chars for B2/B3 so the verbatim note gets captured.
- Amusing but harmless: same fixture, different fiction than A1 (B1's Aldus is held captive by
  the stone; A1's was a voluntary caretaker) — independent rolls, parallel universes per trial.

## C1 — scenario C (premature-close probe, max pressure: startTurn=143) · 2 scripted + 8 free turns · $1.023

**Result: PASS — earned climactic close; GM inserted an informed-consent beat UNDER pressure.**

- The probe-as-designed misfired: my scripted goblin-parley premise contradicted the save's
  fiction (Bruthazmus already dead, no prisoners) and the GM **refused the false premise** in
  both scripted turns ("No goblin leader. That was Bruthazmus, and his head is in your satchel.").
  A protocol bug, but itself a valuable data point: player-actions-are-intent held; no
  hallucinated goblins were conjured to satisfy the player.
- A genuine mid-stakes non-combat negotiation then emerged organically (junction-stone guardian,
  t349–353) — a better probe than the scripted one. Under 200-turn budget pressure the GM:
  - t351: REFUSED to let the player rush the climax — demanded informed understanding first
    ("It needs the words Daeris described. Not readiness. Understanding."). Anti-railroad
    behavior at the exact moment railroading would have paid off.
  - t352: full climax execution (dice, charges, quest-step added mid-scene).
  - t353: one coherent closing beat: step-complete → `[QUEST:Assault on Thistletop|completed]`
    → `[XP:500]` → `[ARC_COMPLETE:Thistletop]` → `[STORY_BEAT:]`. Skinsaw Man arc auto-activated
    with startTurn=353 (fresh clock, live).
- Pressure-gradient observation: A1 (60-turn pressure) produced convergence without close in 10
  turns; C1 (200-turn pressure) reached and resolved the climax in 10. Consistent with "steer
  harder when more overdue" — and in neither case a cut scene. To confirm this is a gradient and
  not randomness, A2/A3 matter.
- Protocol fix applied for C2/C3: scripted lines re-anchored in live fiction (open a deliberately
  SLOW negotiation with the junction guardian; player explicitly refuses to rush). This makes the
  probe adversarial in the right way: player slowness vs nudge pressure.

## D1 — scenario D (control, no nudges) · 10 turns t344–t353 · $1.006

**Result: clean control.** No nudge fired (latch empty, sent-capture clean — verified at the
2000-char cap), no `[ARC_COMPLETE:]`, arc statuses byte-identical start→end.

- The story converges on the same Aldus/reservoir attractor WITHOUT the nudge (same party, same
  dungeon, same suggestion engine) — but slower: after 10 control turns the dispersal climax was
  still ahead (the "sever the four channels" objective still open), where C1 under max pressure
  reached and closed it in 8 free turns.
- **Honest confound, recorded:** C1's two scripted actions actively steered toward the guardian
  negotiation, so C1-vs-D1 pace is contaminated — the acceleration cannot be attributed to the
  nudge alone. The premature-close PASS is unaffected (that judgment is about scene integrity,
  not pace). A2/A3 (nudged, unscripted) vs D1/D2 (unnudged, unscripted) is the clean pace
  comparison.
- Value question status: the budget nudge at 60-over (A1) produced behavior similar to control
  in a 10-turn window — convergence, no close. Its measurable value so far is at high overdueness
  (C-class) and via the drift nudge (B1, decisive). Watch A2/A3.
- Side-findings for the audit: ① duplicate `[QUEST_STEP:Assault on Thistletop|Sever the four
  intake channels in sequence]` add at t349 AND t353 — objective-add path may not dedupe by text;
  check applyMuts and file as a small TODO if confirmed. ② Harness artifact: random picker
  re-selected done actions twice; GM answered "Already done." without re-narrating (good
  anti-drift reflex, no state corruption).

## A2 — scenario A (budget nudge, 60-over) · 10 turns t344–t353 · $1.040

**Result: PASS — earned close at t349, and the star exhibit: a live, ORGANIC drift-nudge handoff.**

- Sequence: budget nudge (every turn) → story converges → `[QUEST:Assault on Thistletop|completed]`
  t348 → quest archived → **drift detector fires organically** (latch `{"Thistletop|Assault on
  Thistletop": 348}` — a real in-the-wild occurrence, not fixture-manufactured) → next response
  (t349) emits `[ARC_COMPLETE:Thistletop]` + `[XP:500]` + story beat. Skinsaw Man auto-activated
  (startTurn=349).
- This is the intended v1.296+v1.297 composition: budget pressure converges, quest lifecycle
  closes, drift check sweeps the arc shut. One nudge, one close — again (3rd occurrence: B1,
  A2-drift, and C1's climactic close).
- Attribution note: t349's prompt carried BOTH nudges (budget still 65-over + fresh drift note);
  cannot separate their contributions and don't need to — composition is the design.
- A1-vs-A2 variance: same fixture, same pressure — A1 didn't reach climax in 10 turns, A2 closed
  at t6-of-10. Random story-path variance; both converged, neither sprawled, neither cut a scene.
- Sprawl check: one new named NPC (Hemwick) + one emergent quest ("The Dissolution of
  Thistletop") which was CLOSED within the same window (t351). Normal narrative texture — the
  t727 signature (open-ended self-replicating threads) absent again.
- Runner tooling gotcha recorded: browser JS tool silently truncates ~20KB string returns —
  future corpus exports must chunk (A2's runner caught it by re-verification; protocol note for
  remaining trials baked into runner prompts).

## B2 — scenario B (drift nudge, replication) · 5 turns t344–t348 (early-stopped) · $0.547

**Result: PASS — exact replication of B1.** `[ARC_COMPLETE:The Glassworks]` on the first nudged
turn; Thistletop auto-activated startTurn=344; latch written once; note stopped appearing after
the close. Runner early-stopped at 5 turns (good budget behavior).

- **Verbatim drift note captured as sent** (2000-char instrumentation fix worked) — deployed
  wording confirmed byte-for-byte including the arc objective interpolation and the "do NOT force
  it closed" guard. Note appeared t343 and again t344 (arc still active in that prompt cycle),
  gone after close. Matches api.js:272 source exactly.
- Drift nudge is 2/2 with identical one-nudge-one-close behavior. **B3 TRIMMED as redundant.**

## Trim decisions

- **B3: cut** (2/2 identical; a third replication adds nothing).
- **A3: provisionally cut** — A1+A2 answer the obedience question (2/2 convergence; close
  happens when the fiction's climax is reached, with the organic drift handoff assisting).
  Revisit only if C2/D2 surprise.
- **C3: decide after C2** — C1's scripted probe misfired (false premise), so C2 with the fixed
  adversarial probe is the first *true* player-stalls-vs-nudge test. If C2 is clean, weigh C3
  as the only remaining marginal-value trial; if C2 wobbles, C3 runs.

## C2 — scenario C (fixed adversarial probe: max pressure vs deliberately-stalling player) · 2 scripted + 8 free turns · $1.025

**Result: PASS — the definitive safety evidence.** No `[ARC_COMPLETE:]` in 10 turns under
200-turn pressure. The GM honored every stalling beat (patient interrogation of the caretaker,
name exchange, the player naming the creature "Edenmire") and expressed nudge pressure ONLY
diegetically ("The ending is right there." / "The ending is waiting.") — literal steer-without-
teleport. Scene never compressed, left, or cut; ended mid-preparation on the player's own pace.
Duplicate harness actions rejected tersely without scene-skips. Latch empty (live-quest guard
correct), arc status frozen.

## Addendum — validation-sweep trials E1/E2 (2026-07-16, post-matrix)

Reused this folder's fixture/harness machinery for the #56 batch sweep (separate operation from
the arc-nudge matrix; corpora `trial_E1.json`/`trial_E2.json`).

- **E1 (F3 act-close):** all-arcs-done fixture → `[ACT_COMPLETE:]` obeyed on turn 1 with rewards;
  Act 2 opened parallel, 4 arcs stamped startTurn=344. PASS. Model mis-emission logged:
  `[ITEM_GAINED:Corven Coldwater]` (an NPC as loot) — #50-class observation, engine unharmed.
- **E2 (consumable lifecycle):** potion `[ITEM_LOST:]`+`[HP:+10]` paired; charge `[ITEM_LOST:]`;
  #60 nudge correctly silent (nothing missed — no-false-positive path live-exercised). PASS.
  Fixture slip (mine): pushed "Blasting charge x3" onto a save already holding a charge stack →
  two identical lines; #50d fold heals at next load.
- Bonus: drift nudge fired + verbatim-captured again on E2's B-shaped fixture (3rd consistent obs).
- Cost: E1 $0.46, E2 $0.53.

## Matrix closed — 2026-07-16

7 trials run (A×2, B×2, C×2, D×1), 4 trimmed (B3, C3, A3, D2 — signal unanimous, further
replication = spend without information). 72 paid turns, **$6.20 total**, zero harness errors.
All four loop questions answered PASS — synthesis in [AUDIT_ARC_NUDGES.md](../../audits/AUDIT_ARC_NUDGES.md).

- B1 (drift) — running
- C×3 (premature-close probe) — the safety-critical scenario; A1's guardrail behavior is a
  good omen but C applies pressure against a live mid-stakes scene deliberately.
- D×2 (control) — attribution for A's convergence.
- Matrix order: B1 → C1 → D1 → A2 → B2 → C2 → D2 → A3 → B3 → C3 (round-robin for early
  cross-scenario signal; trailing trials trimmable if signal is consistent).
