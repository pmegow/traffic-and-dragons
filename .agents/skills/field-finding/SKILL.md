---
name: field-finding
description: Root-cause a behaviour the user saw in a live campaign — "/field-finding <what you saw, ideally with a turn number>" grounds the observation in the real save/transcript, finds the mechanism, classifies it against the drift surface, and lands a TODO.md row. Investigation only, no code. Use when the user reports something the GM/engine did wrong in their own play session (as opposed to /bugs, which triages filed webhook error reports).
---

# /field-finding — live-play observation → root cause → TODO row

The input is **the user's own eyes on a live turn** ("the GM ate my potion at t612", "party bonds
went generic after the merge"), not a filed crash report. `/bugs` owns filed reports; this owns
field observations. Output is a **grounded mechanism and a TODO.md row** — never a code change.

**INVESTIGATION ONLY.** No edits, including "trivial" ones spotted on the way — file those as
observations. Acting comes after, as its own task, under the normal standing rules.

**Tier: Fable.** Nearly every field finding lands somewhere on the drift surface (applyMuts write
paths · memory tiers · buildSysPrompt canon blocks + the stable/volatile split · cleanTxt + tag
vocabulary · transcript integrity · quest/skeleton teeth), and its failures are SILENT. Do not
hand this to a lighter session even when it looks mechanical. If a non-Fable session runs it
anyway, log the row to `todo_checkWithFable.md`.

## Procedure

1. **Ground it before explaining it.** Get the evidence into the session first: turn number,
   campaign, and the actual save. Read `worldState.transcript` around the turn (and `__pt` /
   `dev/corpus_*.json` if it came from a playtest). Never make "cache / environment / their setup"
   the first explanation for something you haven't reproduced. If the observation is too vague to
   ground, ask ONE question (which campaign, roughly which turn) rather than guessing.
2. **Reproduce the failure condition, not a benign case.** The repro is the exact input that
   breaks it — the overflowing field, the malformed tag, the empty list, the over-cap case. A
   check that can't fail proves nothing. Where a harness exists, write the failing assertion first
   (`dev/engine-tests.js`); for a visual finding, script the edge case AND capture the render.
3. **State the mechanism.** *Why* it happens, in one paragraph, naming the file and line. If you
   can't explain the cause, you haven't found it — say so and stop there rather than shipping a
   refined guess. A previously failed fix on the same symptom is a STOP signal: go deeper, don't
   iterate.
4. **Classify.** Drift surface yes/no · silent vs. loud · one-off vs. a failure CLASS. Second
   instance of a class → enumerate the whole class, don't propose a third point-fix. Include the
   monotonic-resources question when anything accumulates per-turn/per-session.
5. **Sketch the remedy** — the root-cause fix, its test plan (which assertion, which byte-identity
   check), and what it touches. If the instruction is losing to the GM's own recent output, the
   answer is a new CHANNEL (engine note), not a new position in the system prompt.
6. **Land the TODO.md row** in the standard table shape: TLDR-first plain-language sentence, then
   mechanism, evidence (turn refs), remedy, tier. Commit tracker-only (no APP_VERSION bump).
7. **Report and recommend, don't act.** End with what you'd do next and what it would touch, and
   let the user greenlight — naming a todo is not a green light.

## Honest negatives are findings

"Observed once, mechanism not found, insufficient evidence" is a legitimate outcome — file it as a
light-evidence row with what was checked and what would confirm it, rather than inventing a cause.
Same for "reproduced, and it's correct behaviour": record the row as not-a-bug with the reasoning
so the next session doesn't re-litigate it.
