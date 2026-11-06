# Individual Melt puddles — #689

Date: 2026-11-05. Host: v1.1349. Dice: 0.92.0 / 5fb0199, copied by the committed-source publisher.

The owner requested removing the large round puddle at the end and fading individual puddles. The effect previously introduced a separate shared surface, drew the original pieces inward, sank and hid them, then faded the merged pool. Dice 0.92.0 removes that handoff. Original slumped pieces and remaining goo stay where they land and share a smooth opacity/shadow fade, with depth writes disabled during fading. Duration remains 3.1 seconds and the sound envelope is unchanged.

Upstream docs/MELT_INDIVIDUAL_2026-11-05.md records the before/after renders, failing-first regression and 409 passing tests. The baseline retained zero of five original pieces before fading; the new ending retains all five, with matching surface and shadow opacities of 1, 0.5 and 0. Phone and desktop ending checks pass. All six shapes and seven finishes, including glass and quartz, render correctly; a real 24-d20 clear and three cancellation stages leave no scene residue. Physical phone performance is not measured by these browser tests.

This implements the new scoped ending request while preserving the earlier closed refinement history. Host engine/state/prompt/parser behavior and all host test assertions remain unchanged. Required commit/push hooks run full host checks; deployed hash and live ending receipts will be recorded upstream. Prior hosted CI 42152270419 failed #679's existing Melt-dismiss timeout; local passes do not establish that remote timeout is resolved. Owner visual acceptance and the complete store-candidate/device matrix remain owed.
