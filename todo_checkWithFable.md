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

**How to review:** `/fable-review <entry>` (validated workflow — see `.claude/skills/fable-review`).
When Fable is satisfied (or files follow-ups), move the entry's full record to
[audits/FABLE_REVIEW_RECORDS.md](audits/FABLE_REVIEW_RECORDS.md) and add one line to the
**Reviewed index** below. This file stays lean; the archive holds the receipts.

---

## Pending Fable review

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

### 12 — Project-wide drift-risk audit against Runelords t1549 (Sol, no code shipped)

**Filed:** 2026-08-08. **Artifact:** `DOC/Drift_risks_SOL.html`. **Trackers:** TODO
#144–#147; existing TODO #136, #5, and #7 are cross-referenced rather than duplicated.
The owner requested a conservative whole-project search for places canon may drift, with the latest
Downloads save included and every surviving candidate challenged from three angles. The audit used
the real t1549 state, transcript, tag receipts, reconstructed prompt, exact headless probes, and
counter-evidence. It rejected identity fragmentation in this save, GM-output summary truncation,
map-description coverage, archive growth as canon drift, and the current split-HP display as new
defects.

The four new findings are: temporal scene claims stored as standing NPC knowledge (including a live
18-entry cap violation and oldest-first truncation); raw engine notes making off-scene split members
"hot" and injecting their stale details; a non-idempotent manual clock repair applied twice, leaving
future-born schedules; and `[RETCON:]` suppressing the corrected narration from RAG along with the
mistake. The report also independently reproduces TODO #136's parser/forget risks and records the
known audit-latch and sync-revision limitations. No source, save, or runtime state was repaired.

**Review first:** reconstruct the t1549 volatile prompt and confirm that Frizwick/Daeris are selected
only through the split-audit note; adjudicate whether temporal knowledge and selector provenance are
one task or two; verify the t1525→t1526 −2320 clock discontinuity cannot arise from a normal write
path; challenge the proposed canonical-correction RAG shape against the reason the `GM:` meta filter
exists. The ranked remedies are recommendations, not pre-approved designs.

### 11 — Runelords t1467 phantom-presence field analysis (Sol, no code shipped)

**Filed:** 2026-08-07. **Artifact:** `DOC/OffTheRails_sol.html`. **Tracker:** TODO #137.
The owner requested independent Sol and Fable deep dives into the latest campaign export. Sol's
finding is that fiction/state first diverged again at t1443 (Daeris stays at the inn) and t1457
(Morwen remains outside the sealed Spire door); Daeris' first visible teleport is t1463, and the
t1466 summary then fossilizes it. Both split responses ran on v1.544/v1.546, before #135's v1.550
fresh-split grace, so the strongest mechanism is the already-reproduced dies-at-birth purge, but
the save no longer retains enough raw-tag provenance to distinguish that from GM non-emission.
The remaining unbuilt class is missing-record phantom presence: every audit starts from an existing
`splitLoc`, while party sheets and `buildSceneManifest` equate membership with co-presence.

**Review first:** independently adjudicate the purge-vs-non-emission confidence; verify the t1443,
t1457, and t1463 transcript chain; decide whether #137 should be one presence-invariant task or split
into (a) missing-transition compliance and (b) party-sheet/scene-manifest split awareness. Confirm
the negative Frizwick finding: the export records her inside with HP 52/52 and no split, so her
reported missing HP is not explained by campaign location state. No source or save repair shipped.

---

## Reviewed index

Full records: [audits/FABLE_REVIEW_RECORDS.md](audits/FABLE_REVIEW_RECORDS.md). Queue drained to
zero 2026-07-27 and again 2026-07-30.

| # | Subject | Reviewed | Verdict |
|---|---|---|---|
| 13 | Sol W1–7 drift-hardening handoff (v1.601) — six-brief delegated-evidence review, self-adjudicated on Fable | 2026-08-12 | 8 confirmed boundary defects fixed v1.602 failing-test-first — two resurrected origin incidents (stripped-tag reward leak; array-typed t1644 W6 bypass) plus receipt-cap permadeath, same-turn/quarantined-txn citations, latched-frame drop, over-length bond orphan, merge self-edges, eras import drop; +13 tests, +8 sabotage clauses (W2 15/15, W7 27/27), 3 tautological clauses repaired, counts corrected; follow-ups #169–#171 |
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
