# Closer roller home view

Document version: 1.0.0. Host: v1.1342. Dice: 0.85.0 / 29656c9.

The roller previously opened and reset at full-tray distance although the owner's reference uses a closer manual zoom. Dice 0.85.0 configures its startup and reset camera together at zoom 0.7. Its tray control remains 1.00×; the shared renderer default stays 1, and the game's explicit zoom 0.5 remains in ui-dice.js.

Upstream verification: 396 tests, the reference's five-d6 seed 3254434604 and a 24-die mixed roll at seed 77, phone 390 × 851 and desktop 1200 × 800, immediate/eased reset and frame containment. The candidate 0.65 zoom refused the crowded desktop case, so 0.7 was selected without relaxing physics gates. Rendered before/after evidence and full output are committed in [the Dice source](https://github.com/pmegow/dice-sim/blob/29656c9/docs/CAMERA_DEFAULT_2026-11-02.md).

The host's required engine/source and browser gates run at commit and push. The #681 suite verifies the independently enlarged ready and damage dice on desktop/phone. These viewport checks are not physical-device or store-candidate certification.

Prior hosted CI (v1.1341, run 41290967987) failed the existing #679 exit-dismiss timeout although its local gates passed. This release changes the standalone camera, not that animation or its test; a local pass must not be described as a hosted-CI pass.
