# #397 scene-led posture — v1.896

The owner reported a repeated low, forward-leaning crouch and explicitly asked to remove the three identified action-pose directives, implement posture based on the actual scene, and commit/push/release.

The writer brief required comic-book posing, exaggerated diagonal bodies, a mid-action pose for every figure, a foreground crop and a preference for motion over static posture. These instructions applied to quiet scenes too. The August 21 archived prompt in DOC/Research/party_render_engines.html already translated them into "lunges forward in a low crouch". That is evidence of the writer generating this pose, not proof of the exact prompt behind the latest screenshot.

## Change

Removed all three requested lines and their stale explanatory comments. Replaced the opening demand for dramatic mid-motion with a single scene-led posture rule: actual activity and posture come from the scene; stillness is valid; movement and intensity require story support. Removed mandatory motion cues from the closing camera instruction and the solo mid-action requirement. The image-reference suffix preserves written posture/activity, including stillness, instead of imposing a new action pose or pose-variety quota.

Gender, appearance, painterly style, reference identity, focal-point orientation, conditional movement direction and historical-scene handling remain covered. The broader composition lesson and complete staging rewrite in #397 remain open.

## Verification

- Test first: both new #397 checks failed against the old implementation: scene-led posture/stillness missing; reference compositor still imposed action.
- Updated only the old assertions that explicitly demanded the owner-rejected action directives. Existing surrounding identity/staging checks remain.
- Two focused checks cover quiet and mixed moving/stationary scene prose, solo/party requests, absence of compulsory pose/crop/motion examples and the reference compositor instruction.
- Five named mutation proofs: remove stillness, reintroduce mandatory action, remove movement grounding, force camera motion, force action through references. All caught by their intended #397 test; game.js restored byte-identical.
- Browser: real doRender path exercised for quiet seated and mixed running/standing scenes, with no references and with two portrait references. Captured writer requests and final image request bodies; all four passed. External model/image responses were stubbed in a disposable browser profile; no paid API calls or user campaign changes.
- Full suite: ALL GREEN, 2,090 engine assertions and 31 standalone suites. Deployment results are recorded in CI and the release report.

## Limits and resources

This verifies the instructions and transport, not stochastic painter compliance. No fresh AI-generated comparison images were produced; the owner's next renders will establish whether the recurring crouch becomes less frequent. Per-call string wording changes only: no new timers, retained collections, storage fields, caches beyond the required version bump, or per-session/campaign/device resource growth.
