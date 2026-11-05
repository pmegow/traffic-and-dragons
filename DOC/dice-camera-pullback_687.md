# Smaller roller camera — #687

Date: 2026-11-05. Host: v1.1347. Dice: 0.90.0 / 7c91e00, copied by the committed-source publisher.

The owner reports improved feel after the transparency optimization but continued phone lag at the close zoom, and requests the saved smaller-dice screenshot as the default. The standalone roller now opens and resets at distance multiplier 1.1 instead of 0.7. TnD's separately configured embedded camera stays unchanged, as do tray units, transparency settings and fling behavior.

Upstream docs/CAMERA_PULLBACK_2026-11-05.md records the reference and rendered comparison. Three d6s at the reference's screen positions measure 59-72 CSS pixels wide in a 375 x 826 phone view with the drawer closed. The existing camera regression fails all three startup assertions before the change and passes after. It covers phone closed/open drawer and desktop, startup, immediate/eased reset, resize and 24 mixed dice at seed 77. All 404 Dice tests pass. Actual phone FPS and owner visual acceptance remain unmeasured.

The mandatory host commit and push hooks run the full engine/verifier/browser gates. Production hashes and live camera checks are recorded in the upstream release plan after deployment. Prior hosted CI 42117920202 failed the existing #679 Melt-dismiss timeout; no test is relaxed and the abandoned animation task is not reopened.
