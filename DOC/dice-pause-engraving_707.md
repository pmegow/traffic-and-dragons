# Longer Going Down pause and gentle metal engraving (#704, #707)

TnD v1.1373 publishes Dice 0.99.7 through its publisher from
d5d2983d8faf8823c60557af50bc9998a303e8c6. Application bytes are identical to
upstream implementation 779f479; intervening commits only update task/release records.

Going Down holds at its raised apex for 140 ms instead of 60 ms, retaining the
120 ms rise, height and suction speed. The exit is 80 ms longer overall. The
recorded fire sound covers the full hold and fade. Metal numerals and classic
dots regain a shallow recess at 10% of standard engraving strength; the other
finishes retain their existing depth. Both large and original-size numerals
were checked on Brass and Steel, including dark faces and a phone viewport.

The owner's previous publication hold is resolved: wizard #706 was separately
published as 58df6387 (Cloudflare 2026-11-08T05:14:04Z, November 7 locally), with
successful hosted CI. The owner now explicitly requests publishing Dice.

Upstream evidence: `docs/pause-engraving-0.99.7/` in dice-sim. All 443 tests pass
on these unchanged application bytes. Failing-first motion and engraving guards,
all six actual mesh hold/clearance checks, real phone cleanup and visually
inspected before/after renders are recorded. Both native copies match 84 assets;
no binary/device claim is made.

The installed commit/push hooks, selected mutation batteries, deployment and
live asset/behavior checks run for this publication. Final logs and receipts
are recorded upstream in `docs/pause-engraving-0.99.7/live/` and `TODO_RELEASE.md`.
No gate is claimed passed here before its run completes.
