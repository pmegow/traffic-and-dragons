# Centered roller sliders

Document version: 1.0.0. Host: v1.1343. Dice: 0.86.0 / cead15c.

The standalone controls used actual multipliers on linear tracks; asymmetric ranges placed 1 at 42.86% for Speed and 13.04% for Tray size. A shared mapping puts both defaults at the midpoint while keeping speed 0.25–2 by 0.05 and tray size 0.7–3 by 0.1. Arrow keys move by real stops, pointer input snaps to them, and output/accessibility values use actual multipliers. Surface is renamed Tray Type; saved look keys, physical defaults and host zoom remain unchanged.

The old rendered midpoint assertion failed. Upstream 398 tests pass; phone 390 × 851 and desktop 1200 × 800 checks exercise real pointer/keyboard events, both limits, the midpoint, clamping, real tray scale and playback speed. [Committed measurements and screenshots](https://github.com/pmegow/dice-sim/blob/cead15c/docs/SLIDERS_2026-11-02.md). Host engine/source and browser gates run at commit/push. These viewport checks do not certify physical devices.

The prior hosted v1.1342 run 41580924079 failed #679 Melt dismissal (timed out waiting for diceLiveState().showing to clear). Local gates passed. This publication does not change that animation or its test and does not claim to resolve the hosted timeout.
