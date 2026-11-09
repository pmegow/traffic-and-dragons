# Drawing finishes and quiet startup (#712)

TnD v1.1380 vendors Dice 0.99.16 from source commit
8ad7a20dbf08b4b609298a98b408ff8e079aa555. The owner requested a local game
commit for the next game push, with further visual tuning held for a motion
comparison. This change does not publish the game.

The update from hosted Dice 0.99.8 includes an empty opening table, Bone for
first-time users, remembered appearance settings, Sketch and Ink Sketch
presets, continuous straight hatch strokes with moderate irregularity, planar
bevel shading, ink-colored bevels and profile outlines, and hatched cast
shadows. In a mixed bag the shared floor shadows use hatching while a drawing
finish is present, including its exit animation.

The missing profile came from bevels becoming too narrow at the silhouette.
Ink Sketch now adds a 1.75 CSS-pixel back-face outline using the numeral ink.
It shares the die geometry and exit state, casts no additional shadow and
never intercepts picking; its owned material is disposed on style changes
and removal. Other finishes keep their existing profiles.

Upstream evidence lives in dice-sim/docs/ink-profile-0.99.16 and the preceding
sketch/ink-sketch evidence directories. All 447 source tests pass. Rendered
checks cover six die shapes on desktop and phone, three orbit angles, ink
recoloring, switching finishes and disposal, picking, synchronized Fade
opacity and final cleanup. Both native packages match 87 shared assets;
this is packaging verification, not native compilation or device testing.
All 88 vendored web assets were independently SHA-256 checked against
roller/RELEASE.json after copying from committed Git blobs.

The normal pre-commit hook requires the full game engine suite and metadata
checks for this commit. Pre-push browser/mutation gates, deployment receipt
and live-site verification are deferred to the next game push. Owner visual
acceptance in motion remains open. The preceding Atlas change is its own
commit (ede74e8b); the unrelated website image remains outside this change.
