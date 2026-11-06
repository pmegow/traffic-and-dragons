# Immediate Melt fade — #690

Date: 2026-11-05. Host: v1.1354. Dice: 0.93.0 / 667a670, copied by the committed-source publisher.

The owner requested fading as soon as puddles reach maximum size and withdrew the camera concern. Previous Dice 0.92.0 held for 0.7 seconds after its latest possible slump completion, even when the actual pieces finished earlier. The reproduced phone case finished spreading at 1.533 seconds but waited until 2.45 seconds to fade.

The shared fade now follows the latest actual piece start, with no hold. Pending pieces prevent premature fading, and the existing slump deadline bounds late frames. The 0.65-second surface/shadow fade remains; the maximum lifecycle and derived sizzle envelope shorten from 3.1 to 2.4 seconds. Camera settings and code are unchanged.

Upstream docs/MELT_TIMING_2026-11-05.md records 411 passing Node tests, failing-first timing assertions and renders, and phone opacity decreasing on the first frame after full spread. All six shapes and seven finishes, a real 24-d20 clear and three cancellation stages pass without residue. Offline audio renders without clipping; its deliberately quiet post-envelope tail measures -79.87 dBFS RMS.

Required commit and push hooks run the full host gates. Public hash and live phone timing receipts are recorded upstream after publication. No host assertions were relaxed or skipped, and no engine/state/prompt/parser files changed. Previous hosted CI 42154322604 failed the existing #679 Melt-dismiss timeout; local checks do not establish remote resolution. Owner acceptance and the full physical-device/store-candidate matrix remain outstanding.
