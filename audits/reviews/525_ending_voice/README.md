# Review evidence for #525 (held build)

The probes two independent reviewers wrote against this branch on 2026-10-02. The record of what
they found is `audits/AUDIT_2026_10_02_525_ending_voice.md`.

- `review1/` reviewed `f28e871b` (with #514 and #506). `p525_loadpath.js` reproduces the stacked
  prefix; `p525_newcampaign.js` the mid-session arrival; `p525_fate_you.js` the Hall line.
- `review2/` reviewed `b11be9d1`. `p10_fates.js` reproduces the shared-surname fault, `p19_scripts.js`
  the deleted ending in scripts without letter case, `p3_split.js` and `p18_recordtext.js` the
  RECORD-line shapes. `h.js` is its harness.

The scripts load the engine through a harness that points at the review session's scratch folder;
change the paths at the top of each harness to this checkout (`dev/load-engine.js` loads the engine).
