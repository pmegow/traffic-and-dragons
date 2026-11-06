# Remove Melt — #691

Date: 2026-11-05. Host: v1.1355. Dice: 0.94.0 / c99a447, copied by the committed-source publisher.

The owner requested removing Melt. The shared registry retires it from the standalone and host menus, Random and Mixed bag. One upstream resolver maps legacy API and standalone saved selections to Fade; direct legacy effect dispatch is also Fade. TnD retains its existing generic removed-choice fallback: a stored Melt preference selects Smoke puff on reload. Camera, physics and other exit behavior are unchanged.

The old Melt-playing assertion is replaced by the requested behavior: menu absence, an actual reload with Melt stored, Smoke puff selected and worn by the overlay, visible real roll/dismissal, zero remaining exits and exactly one close callback. The updated tests fail against Dice 0.93.0 because Melt is still listed and selected/worn after reload. A first fixture attempt changed storage after the overlay existed; it was corrected to reload so the test reproduces startup accurately. No host behavior was changed for the fixture.

Upstream docs/MELT_REMOVAL_2026-11-05.md records the failing-first source/menu probes, 411 passing tests and inspected phone render. The browser probe covers saved migration/reload, both random modes, legacy single/batch requests, constructor/setExit, direct Fade dispatch and a real clear with its breeze sound and no scene residue. Historical Melt geometry code/tests remain inactive; the retired animation probe is replaced by a removal regression.

Host pre-commit and pre-push gates verify the complete release, including the updated real-game regression. Published hashes and the live phone removal check are recorded upstream after deployment. The prior Melt refinements #689/#690 are closed as superseded. The complete store-candidate/device matrix remains separate from this removal.
