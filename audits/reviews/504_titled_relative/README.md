# Review evidence for #504 (held build)

The probes and fuzzers two independent reviewers wrote against this branch on 2026-10-02.
The record of what they found is `audits/AUDIT_2026_10_02_504_titled_relative.md`.

- `review1/` reviewed commits `5cb5fe66` (#530) and `074adafb` (#504). `base.js` is its harness;
  `p22_fuzz4.js` is its sequence fuzzer.
- `review2/` reviewed `b3cf2507` (#533), `8d31679e` (#534) and `84dda630` (#535). `f01_fuzz.js` is its
  sequence fuzzer; `a22_different_extends.js` and `a19_finding1.js` reproduce the two findings that
  held the build.

To run them again:

1. The scripts load the engine through a harness that points at the review session's scratch
   folder. Change the paths at the top of `review1/base.js` (and the `require` of the session
   harness inside it) to this checkout: `dev/load-engine.js` loads the engine; the session harness
   only added `makeWorld`, `run`, `quiet` and `show` around it.
2. The "before" trees the reviewers compared against were plain `git show <commit>:<file>` copies;
   recreate them with a worktree at that commit.
3. `review1/p22_fuzz4.js` uses a generator that falls into a short cycle (288 distinct sequences of
   30,000). Use the generator in `review2/f01_fuzz.js` instead.
