# Alchemist covered-interior verification — 2026-10-03

Owner report: standing at the alchemist, only the hearth is audible.

## Cause and scope

Read-only fixture: Campaigns/The_Village__Ammut_/saves/The_Village__Ammut__Ammut_t279.tnd. At 13:55 the shop is open and its binding matches. Its saved profile has enclosure covered, setting interior, allows fire/machinery/voices, forbids rain/thunder. Both authored assets accepted only sealed. The profile compatibility gate rejected the simmer, so the generic interior-hearth fallback won.

v1.1134 widens only the two catalog entries to sealed/covered and regenerates the catalog hash. No save, selection policy, mix, recording, timing or drift engine edits.

## Evidence

- Red first: the named #559 test in Interior hearth defaults failed with “saved covered shop plays interior-hearth, not the approved simmer”.
- Green: all 10 assertions in that section, including closed/unknown hours, wrong campaign/shop, silent/forbidden/open profiles, unchanged input and sealed compatibility.
- Isolated Chromium: run node audits/VERIFY_559_covered_alchemist.cjs. Fresh profile, blocked service workers and all external hosts; the save is copied into memory without invoking import/save/sync. Real pointer input unlocks Web Audio. Simmer source running, no pending load/failure, glass sprite decoded and scheduled. Receipt: [JSON](VERIFY_559_covered_alchemist.json). Browser is muted: this verifies playback machinery, not perceived mix or the owner's device. The first harness attempts timed out because synthetic click did not emit the pointerdown needed by the unlock listener; actual CDP pointer input resolved that harness problem.
- Full node dev/run-tests.js: ALL GREEN — 2,633 engine assertions and 93 standalone verifier suites.

Owner listening check stays open; not archived. Local correction, not deployed by this verification.
