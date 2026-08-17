# todo_checkWithFable.md

**Purpose:** work done by a **non-Fable model** (Opus, Sonnet, Haiku) that deserves Fable-eyed
review lands here with its supporting documentation. Two intake classes:

1. **Drift-surface tasks** (CLAUDE.md ▸ drift-protection policy) built by a lighter session —
   always filed, however small.
2. **Fable-budget-exhausted mode (user rule 2026-07-29): while the Fable budget is out, ALL
   Opus work is documented here** — every substantive task, not just drift-surface — so that
   when the budget renews, the whole batch can be triaged in one pass.

**How to file:** one `###`-headed entry under **Pending Fable review** — what shipped (versions,
commits), what it touches, why it's risky or not, supporting docs/tests, and what a reviewer
should probe first. Self-contained enough that a Fable session needs no other context.

## Off-Fable log

Safe-changes-map work (#21, CLAUDE.md ▸ Dev workflow): ONE line per shipped change —
`- vX.YYY <commit> — <what> (<shape from the map>)`. Batch-skimmed by Fable; if the skims stay
clean, this log graduates away. Anything that outgrew a line belongs under Pending Fable review.

- unversioned · 2026-08-14 — Bible editor toolbar removed Download copy, Capability additions, and Discard draft; source contract + 4/4 sabotage + rendered localhost check (read-only satellite UI + additive dev coverage)
- unversioned · 2026-08-14 — Add to Bible routes through an explicit create-or-replace boundary; missing-add and existing-update contracts + 4/4 sabotage + rendered localhost check (read-only satellite logic + additive dev coverage)
- unversioned · 2026-08-14 — Bible Editor.cmd starts the helper and opens the served editor; offline install alert retired, status made truthful, 10/10 fixtures + 6/6 sabotage + rendered localhost check (satellite UI + additive dev tooling/coverage)
- unversioned · 2026-08-14 — Bible Editor write-token prompt/retry deleted; localhost Origin remains the write authority, direct-file/foreign pages refuse without credentials; 11/11 fixtures + 7/7 sabotage (satellite UI + additive dev coverage)
- unversioned · 2026-08-14 — Shared Bible Editor v1.0.0 label + helper/launcher compatibility handshake; stale helper/page writes refuse, 19/19 fixtures + 13/13 sabotage + rendered check (satellite UI + additive dev tooling/coverage)
- unversioned · 2026-08-15 — Bible Editor v1.1.0 made project-file saving the only workflow: no Save As/download/file-handle writes, loud draft-preserving writer failure, success closes Add form, and launcher lifecycle is exercised; 24/24 fixtures + 17/17 launcher sabotage + 27/27 remaining sabotage + disposable add/update/failure browser run (satellite UI + additive dev tooling/coverage)
- unversioned · 2026-08-15 — Bible Editor v1.1.1 gives the unavailable-writer state the explicit READ ONLY / launch-via-cmd instruction; 25/25 fixtures + 18/18 sabotage + rendered disabled-Save check (satellite UI + additive dev coverage)
- unversioned · 2026-08-15 — Bible Editor v1.1.2 makes write readiness origin-aware: file:// stays read-only even with a healthy helper, Save/Add/Update disable, and capability writes refuse before fetch; 28/28 fixtures + 21/21 launcher sabotage + 27/27 remaining sabotage + disposable disabled-control render (satellite UI + additive dev coverage)

**How to review:** `/fable-review <entry>` (validated workflow — see `.claude/skills/fable-review`).
When Fable is satisfied (or files follow-ups), move the entry's full record to
[audits/FABLE_REVIEW_RECORDS.md](audits/FABLE_REVIEW_RECORDS.md) and add one line to the
**Reviewed index** below. This file stays lean; the archive holds the receipts.

---

## Pending Fable review

### 16 — Gemini pinned to thinkingLevel "low" on every call kind (#22, v1.645; Opus, owner-ruled)

**Filed:** 2026-08-16. **Tracker:** TODO #22. **Commit:** the v1.645 promotion.
**Evidence:** corpus `dev/corpus_playtest_v1644_gemini37low.json` (50 turns, standard Korrag
campaign), save + memento in `testRuns/modelTests/` (gitignored).

**Why this is here, not in the Off-Fable log.** It is not a safe-changes-map shape. The change is
one line of `PROVIDERS.gemini.buildBody`, but what it alters is how much the GM model *reasons
before answering* — and canon obedience is precisely what the anti-drift stack protects. The
sweep already proved tag syntax and canon obedience are separable capabilities (3.5-flash held
the first and failed the second), so a knob on the reasoning budget is drift-adjacent by
construction. Per the decree, ambiguous defaults to Fable; the owner ruled the adoption, so it
shipped, and this is the standing non-Fable log entry.

**What was measured.** `thinkingLevel:"low"` accepted; `"minimal"` rejected by this model with
HTTP 400 ("Thinking level MINIMAL is not supported"), so low is the floor. 50/50 turns, run-scoped
in-page patch (no repo edit until this promotion). Both contract halves held: 0/50 zero-tag turns,
39 distinct tags (vs 36 thinking-on), 366 total (vs 274), 0 unknown (census derived from
tag_table.js); dead-actor scan clean across 4 deaths, and all 4 death tags landed the same turn as
the prose kill — the thinking-ON sibling is the arm with the premature-tag blemish (t42 tag / t46
prose), not this one. Premise retention >= baseline. Paired A/B on one identical 17,305-token live
gameplay prompt: thinking-ON median 275 thought + 178 visible (~453 billable) @ 4.9s (n=5);
LOW 0 thought + 296 visible (296 billable) @ 2.5s (n=2). Owner read the compiled memento and
judged it good — the prose half of the verdict, consistent with 727 chars/turn vs 647.

**What a reviewer should probe first.** (1) The A/B's thinking-on side is n=5 against n=2 — a 503
load-shedding storm ate samples; re-measure if the cost claim is load-bearing for pricing.
(2) The config now rides EVERY call kind including `summarize()` — the run filed 6 chapters across
5 summarize calls with clean JSON, but extraction quality under low reasoning deserves a harder
look than one campaign. (3) One campaign, one tone, one voice, one seed — the #22 field-validation
width caveat applies to this arm exactly as it does to the others. (4) The guard is a pinned engine
test (`#22 gemini buildBody pins thinkingLevel 'low'`), verified red before the change; it pins the
value but cannot detect the model silently reinterpreting "low".

### 14 — TTS splitter cross-assignment (#93) and narration stuck in third person (#172), both drift-surface (Opus)

**Filed:** 2026-08-12. **Shipped:** v1.603 → v1.604 (#93, commits `43363ea`, `caa2a92`) and
v1.605 (#172, commit `8a19360`). **Trackers:** TODO #93, TODO #172.

Two drift-surface changes in one session, filed together because they touch the same week's
lesson from opposite ends.

**#93 — `splitSentences` / `deriveSpeakerMapFromTags`.** An unbalanced quote inverted the
dialogue/narration labels for the rest of a paragraph, and since the v1.451 deterministic deriver
that is audible: narration took the `[SAY:]` segment's CHARACTER voice. Also fixed the quote-blind
key match (probe W1 — a real field instance corrected in t1667: Frizwick's `"There,"` was being
spoken in Daeris's voice) and the punctuation-only audio blip. **v1.603 shipped a regression** —
the quoted-run mask was built from RAW text while the units come from CLEAN, so a tag alone on its
own line could hand a tagged line to the WRONG character. Caught by an adversarial review pass,
reproduced by hand against v1.602, and corrected in v1.604 (role-based fault detection, tag
stripping, a straddling-break seam, flattened units consuming the cursor, voice-aware folds).

**#172 — `buildSysPrompt` post-STYLE slot + a new engine note.** Field report: the campaign was
narrating in third person. Two causes: the multiplayer-exit correction was retired by a TURN
COUNTER (proven from the hot-seat `Name:` prefixes in the transcript — multiplayer ran t809–816,
the GM never complied, the counter fired, third person ran to t829), and ordinary single-player
carried NO end-of-prompt person directive at all while the prose voice held that slot
(`howard` campaigns measure 2.7–5.3% second person vs 98–100% for `abercrombie`; this campaign's
`proseAuthor` is `howard`). Now compliance-boxed, with a short unconditional person line, a
cause-agnostic drift detector on the engine-note channel, and a visible multi-PC chip.

**Why it is risky.** #93 touches the speaker-map producer and the splitter that persisted `sp.n`
maps key on. #172 touches `buildSysPrompt`'s volatile tail, `NOTE_BUILDERS`, `NOTE_LATCH_FIELDS`,
and adds a new per-response observer in `commitGmTurn` — the prompt channel the project has
already lost to twice (D12 rounds 1–2).

**Supporting evidence.** #93: corpus diff over 3,902 real GM documents (junk units 164→26, B14c
straddlers 1→0, zero narration→dialogue promotions); 18-mutation sabotage battery, each mutation in
its own process (these helpers are file-scope globals — in-process comparison silently
contaminates, a trap that bit both me and one review agent). #172: predicate measured over 10,043
judged responses with a ZERO false-positive rate, the hero-name-in-narration clause being what takes
it from 34% to 0; 9-mutation sabotage battery in an isolated tree; a NARRATION-PERSON source
contract that fails the build if the turn counter ever returns; live browser verification at v1.605.
The post-ship t1723 export supplies the missing field repro: its affected turns are stamped
v1.594–v1.604 despite the export occurring after the v1.605 commit, and show a single-player Howard
campaign slipping at t1697, then carrying zero second-person narration from t1699 through t1723.
The save has no `mpEnded` latch or companion `isPC`; its retained user messages contain no narration
directive. This is direct RC-B evidence from the pre-v1.605 browser session, not a recurrence under
the fix.
Suite: 1348 green.

**What a reviewer should probe first.**
1. **#172's baseline person line is unconditional** — it now appears in every single-player prompt.
   Confirm it cannot compete with the prose voice (it is deliberately terse) and that no author's
   voice is degraded by it. This is the one change with no measured before/after on live prose.
2. **#93's `_cutOff` fork, deliberately left open:** truncated speech whose cap lands on a period
   still flattens after its first closed quote. Widening the exemption to any trailing fault in a
   final paragraph zeroes the corpus label changes but retires the protection for most GM dialogue.
3. **The `paragraphGaps` detector defects** (findings 9/10/11/15/16 of the #93 review) — identical
   on v1.602 and v1.605, so #93 neither caused nor worsens them, but `buildSayComplianceNudge` fires
   on responses whose speaker map is 100% correct. Deliberately NOT folded into a regression fix;
   they want their own row.
4. Whether `personDrift` belongs in `NOTE_LATCH_FIELDS` (it was added) — the #151 contract passed,
   but the semantics of restoring a drift run after a dead provider turn deserve a second opinion.

---

## Reviewed index

Full records: [audits/FABLE_REVIEW_RECORDS.md](audits/FABLE_REVIEW_RECORDS.md). Queue drained to
zero 2026-07-27 and again 2026-07-30.

| # | Subject | Reviewed | Verdict |
|---|---|---|---|
| 17 | #175b structured presence as a positive death binding (v1.649) — six-brief delegated-evidence review | 2026-08-17 | Design AFFIRMED (owner-ruled; t1903 repair reproducible), implementation violated its own strictly-earlier contract — 7 confirmed defect groups fixed v1.650 failing-test-first: the unpinned executor's silent WRONG-VICTIM kill (a "Caul" envelope with handle "Vex" stamped Caulder Vex dead), the turn-blind lastSeenAt limb, the split-guard half-coverage, the frame-scan sourceTurn ignore, the heal asymmetry, the t1903 nine-record nudge factory + latch misattribution, and the ws-only handle/name disagreement; +13 tests (each red on v1.649) + 5 sabotage clauses; 7 residues accepted with rationale; descriptor fuzziness filed as TODO #193 |
| 15 | Per-character location-visit provenance gap (#173; Codex investigation) | 2026-08-14 | CLOSED outside the queue — guestbook adjudication (`6850d99`) authorized the build with seven pinned amendments; shipped v1.632–v1.633 + map-viewer panel; entry archived 2026-08-17 |
| 13 | Sol W1–7 drift-hardening handoff (v1.601) — six-brief delegated-evidence review, self-adjudicated on Fable | 2026-08-12 | 8 confirmed boundary defects fixed v1.602 failing-test-first — two resurrected origin incidents (stripped-tag reward leak; array-typed t1644 W6 bypass) plus receipt-cap permadeath, same-turn/quarantined-txn citations, latched-frame drop, over-length bond orphan, merge self-edges, eras import drop; +13 tests, +8 sabotage clauses (W2 15/15, W7 27/27), 3 tautological clauses repaired, counts corrected; follow-ups #169–#171 |
| 12 | Project-wide drift-risk audit against Runelords t1549 (Sol) | 2026-08-08 | CLOSED outside the queue — all four findings shipped as #144A/#145/#146/#147 (v1.564–v1.567) + #144B (v1.572), rulings recorded (`9a7bd6d`); entry archived 2026-08-17 |
| 11 | Runelords t1467 phantom-presence field analysis (Sol) | 2026-08-07 | CLOSED outside the queue — Fable×Sol reconciliation (`6bdfe42`) adjudicated purge-vs-non-emission; #137 phantom-presence teeth shipped v1.553; entry archived 2026-08-17 |
| 10 | Parallel-act hook delivery (v1.495) | 2026-07-30 | Placement PASS; 1 CONFIRMED wording defect (referent "inactive arcs" never renders in a parallel act) fixed v1.501 + pin test; untouched spine-name channels measured and filed as TODO #108 |
| 9 | Inventory acquisition toast (#107, v1.500) | 2026-07-30 | Behaviors affirmed with observed outputs; 1 CONFIRMED defect (non-string inventory entry killed the whole turn pre-applyMuts) fixed v1.501 at the _inv* primitives; 3 residues accepted |
| 8 | Campaign-clock batch (v1.496-v1.499 incl. the drift-surface TIME_ADVANCE scene rewrite) | 2026-07-30 | All 4 ship items PASS (cache contract runtime-proven, memo reasoning airtight, day relabel clean); 4 suite hardens + 2 doc fixes v1.501; overshoot measurement BLOCKED on post-v1.496 .ta field data (user action) |
| 7 | TODO #95 speaker casting — four-agent Opus 5 build (v1.440; scope widened to v1.440→v1.461 incl. #96 [SAY:]) | 2026-07-27 | All 5 filed items adjudicated (①②③ PASS, ④ token-half PASS, ⑤ CONFIRMED); 6 confirmed defects + 6 hardens fixed v1.462; 1 new class filed into #93 |
| 6 | B9/B10 voice-stack campaign — 9 versions in one session, all Opus (v1.416→v1.424) | 2026-07-23 | 3 PASS, 1 CONFIRMED finding (fixed v1.429) |
| 5 | #16c diagnostics — one touch inside `summarize()` (drift surface) | 2026-07-24 | v1.407 enrichment PASSES all three asks; 2 confirmed adjacent findings + 2 pre-existing defects fixed v1.439 |
| 4 | Voice/TTS rework — curated Piper set, per-character voice (TODO #9) | 2026-07-24 | 3 CONFIRMED findings fixed v1.439; ★ memo question answered; splitter edges filed (#93) |
| 3 | Campaign clock — new time subsystem + tags + injection + migration (TODO #73) | 2026-07-23 | PASS on 4 of 5; 1 CONFIRMED finding fixed v1.433 |
| 2 | NPC mood/relation separation — schema repair of the character-state tier | 2026-07-24 | Design + core semantics PASS under live fire; 5 confirmed finding groups fixed v1.439; 3 residues accepted |
| 1 | TODO #23 — per-arc pacing budget + inverse arc-drift detector | 2026-07-16 | PASS on all four verify items; no code changes needed (full record also in audits/AUDIT_ARC_NUDGES.md) |
