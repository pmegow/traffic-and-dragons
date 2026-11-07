# Going Down anticipation (#704)

TnD v1.1369 publishes Dice 0.99.5 from upstream de1e167 through the normal
publisher. `roller/RELEASE.json` identifies the source commit and all 85 assets.

Previously the last hover bob drifted downward straight into suction. It now
settles, adds a 120 ms lift of 0.2 bounding radius and holds that height for
60 ms before the existing accelerated pull. Anticipation occupies the end of
the hover; overall duration remains 2.985 seconds. Floor clearance includes
the added height. Other exits and host game logic are unchanged.

Upstream evidence: `docs/pit-anticipation-0.99.5/` in dice-sim. The new motion
test fails first on the prior timeline; all 443 final tests pass. Actual mesh
samples verify the rise, stable hold, floor clearance and three sound cues
for all six shapes. Before/after oblique and overhead renders were inspected;
a real two-die phone clear finishes without page errors. Both native asset
copies match 84 assets; these are not compiled or device-tested packages.

The installed pre-commit and pre-push hooks, selected mutation batteries,
Cloudflare deployment and production asset/render checks run for this
publication. Final logs and receipts are recorded upstream in
`docs/pit-anticipation-0.99.5/live/` and `TODO_RELEASE.md`; no pass is claimed
here before those gates complete.


## Higher lift follow-up (Dice 0.99.6 / TnD v1.1370)

The owner requests a more noticeable upward beat. Anticipation rises from 0.2
radius to 0.3 radius, a 50% increase. The 120 ms rise, 60 ms hold, downward
acceleration and total lifetime remain the same; portal clearance follows
the higher apex through the existing calculation.

Published source: 258dc2ebbe458ee2cdbef5688c19dffe6da5e43a. Upstream
`docs/pit-lift-0.99.6/` records the failing-first motion guard, all 443 tests,
visually inspected before/after oblique and overhead strips, six real mesh
height/hold/clearance checks, phone cleanup and both 84-file native copies.
The prior v1.1369 local gates, production checks and hosted CI all passed.
This follow-up runs the normal gates again; final logs and production receipts
are recorded in that upstream evidence directory's `live/` folder and
`TODO_RELEASE.md`. No native binary/device certification is claimed.
