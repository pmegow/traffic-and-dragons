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
