# Sketch Scurry shader overload (#713)

TnD v1.1381 vendors Dice 0.99.17 / 0bec4e3c8000021d837319cd42177b62a7b7d353.
All 88 runtime assets independently match roller/RELEASE.json by SHA-256.

Scurry's scaled unit cylinders and spheres were shaded as if their raw vertices
were meters. Four exits add 288 leg/joint meshes; the sampled old hatch searches
reach 253 candidate lines per projection, versus six in physical coordinates.
The shader applies mesh scale before shading, bounds each search to 16 candidates,
skips unresolved strokes and avoids discarded projections on planar regions.
Failed graphics startup now stops Loading and offers retry/recovery instructions;
saved looks remain intact and the original failure remains in the console.

Upstream docs/sketch-scurry-0.99.17 contains the evidence: a failing-before rendered
scale-equivalence regression (mean RGB difference 20.523/255 before, zero after),
448 passing source tests, actual desktop/touch-phone UI sequences for both Sketch
finishes, recoloring, four Scurry exits plus a mid-exit d20, repeated resource cleanup
and saved-color reload. Both native bundles match 87 assets; neither was compiled
or physically device-tested. Fault injection reproduces the null precision startup
failure and verifies the loading notice and saved looks.

The local Chromium GPU did not reproduce the owner's full hang/context loss. The
coordinate defect and excess work are established; affected-device recovery still
requires owner retest. No universal FPS/speedup claim is made. The post-processing
proposal was discussed, not implemented.

This local commit is queued for the next game push. Its normal pre-commit hook
requires all engine/metadata gates. Pre-push browser/mutation checks, deployment
and live verification remain for that push; this task does not push the game.
