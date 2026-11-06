# Dice Customize frame — #701

TnD v1.1360 publishes Dice 0.99.0/fca3baf through the shared publisher and its 85-file receipt.
The standalone panel gains a native Customize disclosure, initially collapsed. Preset and
Table Top Material (formerly Surface) stay outside; the remaining settings are grouped inside.
The Space shortcut respects the focused summary, and nested controls reflow in narrow panels.
Stored settings, physics, floor rendering and playback speed are unchanged.

Source checks pass: 427 Node tests, desktop/two portrait-phone/landscape layouts, Enter/Space
handling, color picker, existing controls, saved-preset save/choose/reload/delete and real Roll.
The personal-font regression also passes installed/imported fonts, persistence and fallback.
Failing-first and rendered evidence is in dice-sim/docs/CUSTOMIZE_2026-11-06.md.

Only the release copy, host version/cache markers and release records change here. No host
logic or tests are changed. Standard pre-commit and browser pre-push gates apply; final host
gate outcomes, deployment, native shared-bundle verification and live asset/UI checks are
recorded in dice-sim/TODO_RELEASE.md after publication. No native binary/device pass is claimed.
