# Full-screen dice surfaces — #700

TnD v1.1359 publishes Dice 0.98.0/fb459b2 with the shared publisher and its 85-file receipt.
The old drawn-tray flag selected both the visible box and finite physics/pickup limits.
Every rendered surface now uses screen-edge bounds and a full-viewport floor, retaining its
material's appearance, friction, bounce and recorded sound. Adding dice or changing materials
keeps the camera frame fixed. The headless core's finite-tray API remains available.

Standalone playback opens at 1.2x. The tray-size control is removed; Speed, Seed, Replay last
and bake metadata are hidden. Plain remains available, and transparent game overlays retain
screen-edge behavior. Host product edits are limited to the published copy and release markers.
No host tests are relaxed, and no engine/state/prompt/parser changes are included.

Source verification: 427 tests; a failing-first felt screenshot; all four materials in desktop
and two phone viewport sizes; real throws beyond the old box, pickup bounds, material changes,
24-die rolls without reframing, zoom/pan coverage, hidden controls, the real Roll playback clock,
and saved-surface reload. Both native copies have the same 84 committed assets, but native
binary/device checks remain open. Source evidence: dice-sim/docs/INFINITE_FLOOR_2026-11-06.md.

This commit runs the standard host pre-commit gates; its push runs all browser suites.
Production verification must compare the live receipt and every asset hash, run the same
surface/layout probe against /roller/, and inspect rendered results. Deployment and actual
host gate outcomes will be recorded in dice-sim/TODO_RELEASE.md after publication.
