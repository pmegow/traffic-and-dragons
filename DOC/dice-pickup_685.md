# Instant pickup experiment

Document version: 1.0.0. Host: v1.1345. Dice: 0.87.0 / dec78bb. Date: 2026-11-05.

The owner reported a quick swipe finishing before pickup reached full height. The renderer's 120 ms interpolation updated neither the live hand nor the die's position from pointer movement; release could occur before the hold existed. Pickup now positions the die at its final held pose and creates the hold immediately. Immediate release carries that pose and toss velocity into the baked throw; unpicked dice retain their resting state. The existing scripted lift used by the game is separate.

Upstream checks: 398 tests; failing-first immediate pickup/release and roughly 65 ms pointer flings on phone and desktop; a neighbouring die remains unchanged. [Measurements and renders](https://github.com/pmegow/dice-sim/blob/dec78bb/docs/PICKUP_2026-11-05.md). Warmed release-to-motion timing was already short (13–14 ms before, 16–19 ms after); this is a pickup-feel experiment, not a demonstrated total-latency improvement. Audio unlock is another measured source of first-gesture delay. Owner/device comparison is still owed.

Required host engine/source and browser gates run at commit and push. Previous hosted CI failed the existing live-dice/Melt test; this release does not claim to resolve that separate timeout.
