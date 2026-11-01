# Larger TnD dice

Document version: 1.0.0. App: v1.1341. Dice: 0.84.0 (75185b7).

The standalone tray normalization preserves its apparent size. TnD specifies an explicit 15 × 10 cm frame, so normalization does not enlarge its dice. The owner requested approximately 100% larger dice separately. The host uses the renderer's existing absolute camera zoom, 0.5, once when creating its reused overlay. Halving the tray alone measured only 1.59–1.69× because the camera fit adds a fixed 2 cm margin. Physical die geometry, the game’s requested faces and the shared overlay defaults are unchanged.

The centered d20 measured 2.070× width / 2.065× height at 1150 × 900, and 2.050× / 2.064× at 375 × 667. The dedicated browser regression failed at 1× before the change and passes after it. It also exercises a ready d20, a forced 17, ten d12 damage dice with distinct forced faces, frame containment and exactly one dismiss callback on both viewport sizes. All rendering uses the real host and its published roller; network calls are intercepted by local fixtures. [Measurements](dice-size_681.json).

Visual inspection caught the ready die covering Hold back although the existing pointer test passed: the transparent input layer let clicks through an obscured control. A seeded projection regression reproduced it at seed 1 (die top 379 px; modal bottom 439 px). The roll modal now aligns above the die. Sixteen deterministic presentation seeds require an 8 px gap from the controls; the original modal lifecycle, focus, Hold back and aimed throw checks still pass. [Ready die](dice-size_681-ready-phone.png) · [Maximum damage roll](dice-size_681-damage-phone.png).

These are headless Chrome viewport checks, not physical-device or store-candidate certification.
