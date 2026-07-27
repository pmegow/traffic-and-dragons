---
name: fable-review
description: The delegated-evidence review workflow — "/fable-review <entry-number | surface description>" runs a Fable-tier review by fanning evidence briefs out to parallel Opus agents, then Fable adjudicates, fixes failing-test-first, and writes the receipts. Use when the user asks to run a review from todo_checkWithFable.md, review a drift-surface change, or "run the review workflow" on any named surface. Validated 2026-07-24 (entries 5/2/4 → 10 confirmed defects fixed as v1.439).
---

# /fable-review — delegated-evidence review

The division of labor that works (measured, DOC/FABLE_REVIEW_ACTION.html, 2026-07-24): **the reviewer
model writes tight evidence protocols and issues every verdict; delegate agents execute the
protocols in parallel with tools; the failing-test-first fix discipline doubles as the delegation's
lie detector.** Raw tokens run ~2× a solo pass — the win is reviewer-quota (judgment-only spend),
wall clock (parallel), and DEPTH (sweeps/probes a time-boxed solo pass won't do).

**Tier guard (the 2026-07-09 decree):** verdicts on drift-surface entries and every drift-surface
fix belong to **Fable**. If this session is NOT running on Fable: phases 1–2 (plan + evidence) may
still run, but STOP before phase 3, park the evidence summaries in the queue entry, and tell the
user a Fable session must adjudicate. Never issue a drift-surface verdict from a lighter model.

Queue of record: `todo_checkWithFable.md` (entries pending → Reviewed). Targets outside the queue
(an arbitrary surface or recent change) follow the same phases; the verdict then lands wherever
that work is tracked (TODO row, BUGS row, commit message).

## Phase 1 — Triage & briefs (reviewer, inline)

1. Read the queue entry IN FULL plus every doc it references (TODO rows, DOC/*, commit messages).
2. Triage each sub-item: **review** (evidence needed) / **check** (cheap targeted verification) /
   **harden** (fix if confirmed) / **ignore** (accept, write the rationale NOW so it lands in the
   verdict) / **superseded** (the code no longer exists as reviewed — say what replaced it).
3. Group review+check items into 3–7 independent evidence briefs, one theme each. Independence is
   what buys the parallelism — no brief may depend on another's output.

## Phase 2 — Dispatch (parallel Opus agents)

Launch ALL briefs in one message: Agent tool, `subagent_type: "general-purpose"`,
`model: "opus"`, background. Every brief carries this contract verbatim-in-spirit:

```
EVIDENCE BRIEF <X> — you are gathering evidence for a senior review; you do NOT issue
verdicts, you report facts with file:line citations. Do NOT modify any repo file; scratch
scripts ONLY in your scratchpad. Repo: <absolute path>

Background: <2-4 sentences: what shipped, what the review must answer>

Your tasks: <numbered, concrete: quote X with line numbers; enumerate every Y; run Z
through the real engine via dev/load-engine.js (stub pattern: dev/engine-tests.js lines
15-25) and report ACTUAL OUTPUTS>

Output contract: tables + quoted code + observed outputs; prose budget ~500 words beyond
those. Label anything you could not determine UNDETERMINED/INCONCLUSIVE with the reason —
never round up to certainty. Sweep whatever the question genuinely touches, and SAY SO
when you grow the scope. A factual "gap found / no gap found at the code level" statement
per task is required; recommendations are not yours to make.
```

Brief-quality rules learned the measured way: behavioral questions get RUNTIME probes (load the
real engine headless, capture warns/toasts/state), not code-reading alone; sweeps enumerate BOTH
readers and writers; sync/persistence questions trace every hop (local key → POST → server column
→ pull path) — the pull path especially (the #92 lesson: the adopt hop bypassed the tolerance
everyone assumed covered it).

While agents run, the reviewer may draft ignore-rationales and verdict skeletons — never
predictions of evidence.

## Phase 3 — Adjudication (Fable ONLY)

1. Read each result as it lands. Spot-check load-bearing quotes against the working tree before
   acting on them.
2. **Confirmed defect → failing test FIRST** (engine-tests, named for the finding), watch it fail
   for the evidence's stated reason, fix, watch it green. A test that fails differently than the
   evidence predicted means the evidence is wrong — re-verify before fixing.
3. New guards get sabotage-proven against a SCRATCH COPY, never the working tree (the CRLF
   git-checkout incident, 2026-07-24: in-tree sabotage + restore mangled line endings and broke
   every \n-anchored contract).
4. Fixes that need their own careful session → TODO row with the observed evidence cited, not a
   ride-along fix. Cheap+confirmed → same commit.
5. Records in the SAME commit: queue entry → Reviewed with a verdict block (finding + remedy +
   what was affirmed + accepted residues with rationale — the AUDIT_FABLE shape), TODO rows
   updated/filed, APP_VERSION + sw.js CACHE bumped when game code changed.

## Phase 4 — Receipts

Append to the run's plan doc (or the queue entry when no doc exists): per-brief tokens / tool
calls / wall clock / findings-fed table, a short quality note on the delegate work (accuracy,
adherence, honesty-under-uncertainty, scope discipline), and anything that should change the NEXT
run's briefs. The receipts are what keep the economics honest — without them the workflow's cost
story degrades to vibes.
