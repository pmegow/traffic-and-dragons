# Simultaneous None and Fade (#709)

TnD v1.1375 publishes Dice 0.99.8/7384712. Scheduling previously staggered
by die count alone. Both standalone Clear and the renderer API now resolve
exits before using registry timing: None and Fade start together; other
animations keep their stagger. Random resolved to Fade follows the same rule.

Upstream docs/together-exits-0.99.8 records the failing-first guard, 444 tests,
actual six-die API/UI frame checks and screenshots, and both native asset
copies. No native binary/device claim. Normal commit/push hooks and selected
mutation batteries apply; final production receipts and logs are saved in
that upstream directory's live/ folder and TODO_RELEASE.md.
