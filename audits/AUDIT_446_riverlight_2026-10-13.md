# Task 446 — Riverlight readiness pass, 2026-10-13

**Verdict: the content revision is already published; pacing acceptance remains open.**
The task still said “not built unasked,” although the September 25 editorial work
resolved its reported plot contradictions and published Riverlight v1.0. The live
catalog still serves that revision. This pass found no reason to rewrite the story
before testing its actual behavior with a new player. No blueprint, engine, live
catalog entry, or player save was changed.

## Candidate and provenance

- Reviewed game commit: `1b6033d08590c1091f87e2f92aabed1bf0b586ac`.
- [Blueprint](../samples/the_riverlight_masquerade_one-evening_taster.blueprint):
  **v1.0 Release Candidate**; catalog id `the_riverlight_masquerade_one-evening_taster`.
- File SHA-256: `e6eada2952a5369efd3f3ef095f0bf1aa8b42aa818cbdc94c3b5c82da4bcec15`.
- Read-only GET of `https://traffic-and-dragons-server.fly.dev/catalog/blueprints`:
  Riverlight catalog revision **2**; every top-level blueprint field equals the local source.
- Existing work: `310854e3`, `90c89a5e`, `c1111418`; edition metadata in `eec79615`.
- [Original finding C1](../DOC/Review_astra_2026_09_24.html#c1) and
  [four-pass editorial/release record](reviews/The_Riverlight_Masquerade_AstraReleaseCheck_2026-09-25.html).

## Content findings

| Original concern | Current evidence | Assessment |
|---|---|---|
| Competing accounts of the forged treaty | Premise, Act Two, Act Three, Devrin's notes and rules all describe a planted annex used to frame Petrell. The genuine treaty stays in Ossvane's chest. | Original contradiction resolved. |
| Commissioner confused with scribe | Devrin commissions and plants; Mira knowingly writes the forgery and witnesses the planting. Her murder knowledge is explicitly limited. | Roles are fixed and distinct. |
| Eight required rooms/tasks | Arrival points directly to the coat; the coat plus Brix's authenticated commission establishes the frame. Other leads may be declined, unavailable or superseded without invented discoveries. | A short authored route exists, but model pacing remains unmeasured. |
| Missing the go-between blocks success | Coat + authenticated commission works without meeting Mira, catching her boat, or obtaining a confession. | Independent evidence route exists. |
| Wrong arc count in closing instructions | No “five arcs” requirement remains. Every actual arc has closure guidance; partial outcomes can finish the evening. | Original stale count resolved. |
| Midnight's purpose is unclear | Midnight is the planned public accusation and ratification gathering. Earlier exposure or a justified postponement is allowed. | A meaningful deadline, not an unavoidable magical failure switch. |

The eight arc records remain. Calling a lead optional in prose does not remove its
engine state. The GM must close a declined or superseded lead explicitly and must not
award unvisited evidence. That is the highest-value behavior to observe in a live run.
Solving the frame and solving Orris's murder are separate achievements; a satisfactory
short ending may protect Petrell while referring the killing for investigation.

## Checks performed this pass

Using the current `dev/load-engine.js` in a disposable in-memory world:

- `validateBlueprint` accepts the unmodified candidate.
- `applyBlueprint` preserves all seven NPC dossiers in `memory.npcs[name].authored`
  and all six descriptions in `memory.map.nodes[name].description`.
- `plotArmor` returns null for every authored NPC.
- Sending `ACT_COMPLETE` with the opening arc still active is refused, as expected.
- Closing the real active arcs, then each act, reaches `worldState.spineComplete`
  with all eight arcs completed. The four parallel Act Two leads can close in one
  response; sequential opening and ending arcs require separate responses.
- Current text lengths: premise 2,307; longest objective 708; longest NPC note 751;
  longest rule 378. No content was shortened or re-baselined.

The synthetic trace closed these batches in order:

1. An Invitation and a Warning.
2. The Empty Owl Mask.
3. Cards, Coats and Alibis; The Steward's Ledgers; The Coat in the Conservatory;
   The Moth at the Water-Gate.
4. The Case Before the Toast.
5. What the River Carries Home.

Act-completion tags were sent after each act's arcs closed. The trace supplies tags
explicitly; it proves that the engine supports completion, **not that the GM emits
those tags reliably or that a new player can finish in a given time**.

Two initial probe issues were corrected before these checks passed: the first probe
expected the older `knowledge` field instead of the current provenance-preserving
`authored` field; the next lacked the headless `syncUI` stub. These were probe setup
errors, not lost content or application fixes. Persistence was deferred during the
tag trace; no live campaign or model call was involved.

## Remaining first-time-player test

**Owner-selected target (2026-10-13): about one hour from the first narrated opening
to a chosen ending.** This is a playtest target, not a promised or advertised duration. Record character setup separately. If the player continues
past the target, record the actual duration and why rather than forcing an ending.

Give the new player only the public catalog pitch. Do not show them this spoiler-bearing
review, the blueprint's private truth, a solution route or preferred actions. Observe
without coaching. Record provider/model, build, blueprint edition, opening/ending
wall-clock times, turn count, interruptions and time spent in narration/playback.

After the ending, ask in their own words:

1. Who arranged the frame-up, and who wrote the document?
2. What did you actually discover that supports that conclusion?
3. Why did midnight matter, and what could you do before it?
4. What changed because of your choice? What, if anything, is still unresolved?

Record the answers and any prompts needed. Success requires a comprehensible causal
account and an earned outcome; a confident explanation supplied by the observer is
not evidence of player understanding.

Then run these directed checks separately from the blind first-player session:

| Route | Required observation |
|---|---|
| Coat → Counting-House → settlement; never meet Mira | Documents suffice; no forced witness chase, confession, library visit or room tour. Skipped leads close without invented evidence. |
| Mira leaves or refuses | Existing evidence survives; no replacement witness or new culprit is invented. |
| A single credible discrepancy | A stated check or postponement is available; incomplete evidence is not narrated as certain guilt. |
| Annex secured, but commissioner unidentified | Petrell is protected from an unsupported claim; authorship and murder may remain honestly unresolved. |
| Wrong accusation, then correction | Known facts do not change to validate the accusation; correction remains possible. |

For every run, inspect the actual arc states as well as the prose. An apparent ending
with active arcs is not a completed authored spine. Keep the transcript and the final
save with the result. An automated or experienced-player run can test GM behavior but
cannot substitute for the blind newcomer-comprehension check.

**Closure condition for #446:** attach a real first-player result against the chosen
target, plus the no-Mira route evidence. Keep v1.0 as Release Candidate and retain
its current public wording until those results justify a tighter duration claim.

## Both-panel follow-up, 2026-10-13

At the owner's request, three delegated review passes applied all nine stored
design/writing lenses and all five composite player personas to the unchanged
blueprint identified above. This is rubric-based editorial feedback, not author
participation, interviews or a human playtest. Full evidence, source grades,
mitigations and dissent are in the [design/writing report](../DOC/panel/reviews/riverlight/riverlight_panel_review.html)
and [player report](../DOC/panel/reviews/riverlight/riverlight_players_review.html).

The broader panel review adds two narrow clarifications to the initial readiness
pass; neither calls for a structural rewrite:

1. Explain why Devrin expects Petrell's exclusion to make his barges the main
   carrier while all five holds must assent. Excluding a delegate need not exclude
   a hold; specify the intended mechanism. Preserve the possibility his plan fails.
2. Replace Act Two's “two corroborating routes” with corroborating evidence and
   the already-authored alternatives. This is a wording risk, not observed forced play.

Optional: invite a brief player-authored final act; give Orris one ordinary human
detail, make freight costs tangible in an existing beat, or add Devrin's compact
self-justification. These are nonblocking suggestions, not changes made. Keep
Leiber's preference for the marvellous and Bert/Nan's genre mismatches as dissent;
do not expand the taster to satisfy every preference.

Add directed checks for interrupted audio comprehension, short-session milestones,
document handovers/copies and fictional deadlines across real-world pauses. Use
only discovered facts in recaps; inspect final arc states on the no-Mira route.
No new model calls or play sessions occurred. One-hour acceptance remains open.

This documentation adds two static reports; it introduces no accumulating runtime
resources or new per-turn, session, campaign or device state.

## Three authorized revision-and-panel cycles

The owner requested implementation followed by both panels, repeated three times.
That loop is complete; [full cycle record](../DOC/panel/reviews/riverlight/riverlight_three_cycles.html)
contains all 42 lens/persona assessments, exact snapshots, source grades and dissent.

- **Round 1, v1.01:** clarified the carrier bid/vote distinction and fallible coercion;
  specified evidence combinations; added Orris's paper-boat memory, Devrin's
  self-justification, visible freight pressure and an optional player-authored close.
  Panels found a remaining ending-language propagation issue.
- **Round 2, v1.02:** aligned carrier eligibility and all-five assent in the endings.
  Panels found no further editorial issue. Full runtime normalization separately
  exposed three over-limit fields (1,004/898/878 characters against 800).
- **Round 3, v1.03:** compressed those fields without dropping substantive guidance.
  Panels accepted the compression; one lens caught the lost payment qualifier.
- **Final v1.04 Release Candidate:** restored “the agreed 10 gold”. The originating
  reviewer verified that this and the edition were the only post-round-3 changes.
  This targeted closure was not a fourth broad panel cycle.

Final file SHA-256: `e087f38302019167524fb86d81db30110d7a76ee3079cbea1773b8eb87bab687`.
The full normalize → validate → apply path preserves every authored text field, all
seven NPC dossiers, six location descriptions and sixteen rules. Eight arc records
and no plot armor remain. No new scenes, locations, NPCs or mechanics were added.

Probe limitations were corrected openly: the first probe treated the authored-entry
array as an object; after correction it checked direct application but bypassed
normalization. Adding normalization revealed the overflows, which are now resolved.
No engine code was changed. No narration or real-player timing test was performed.
The one-hour target and prior first-player closure conditions still apply.

The source candidate is updated; a read-only server catalog check still returned
v1.0 Release Candidate, revision 2. No catalog publication or existing-save mutation
was performed in these revision cycles.
