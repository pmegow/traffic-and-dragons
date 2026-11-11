# Designer autosave #725

The previous autosave serialized the entire working blueprint and edition baseline into `bpd_draft_v1` localStorage. Both contain portrait bytes. The browser rejected large writes with QuotaExceededError; reload then restored the older stored draft. New and incoming adoption also deleted the old slot before the replacement was durable.

Designer v0.66 moves the working envelope to IndexedDB. Existing localStorage drafts migrate losslessly and remain intact. Success is transaction completion; revision comparison and replacement share one readwrite transaction. The single writer coalesces pending work. New/import failures preserve the prior durable envelope. The sticky autosave status remains independent of ordinary authoring messages, and pending/failed persistence warns before unloading even after a file export.

Recovery preserves the displaced current envelope atomically in one bounded backup slot. The slot cannot silently overwrite a previous backup. Recovery downloads remain accessible after successful restore; Load accepts downloaded envelopes. Malformed Home handoffs remain stored but do not block the working draft. A damaged-only draft can explicitly start fresh while retaining the damaged data. IndexedDB failure still permits exporting a localStorage backup. Engine version and service-worker cache remain unchanged under the Designer-only carve-out.

## Verification

- Failure-first real Chrome reproduction: a deterministic 1200 × 1200 PNG plus edition baseline made the draft exceed 10 MiB. The old implementation displayed the reported quota error and failed `large portrait draft survives reload byte-for-byte`. The fixed implementation restores that exact working state, including portrait, baseline, original prose and review data.
- Six writer/open tests cover pending state before debounce, serialized/coalesced writes, failed writes and explicit retry, New/import replacement during an active write, conflict refusal, obsolete callbacks and blocked/late opens.
- Twenty-one real-browser cases cover large roundtrip; legacy migration; aborted transactions; stale and simultaneous writers; failed migration; corrupt and unavailable storage; selecting either legacy/saved copy; atomic New/import; retained and damaged recovery; backup bounds/removal; legacy backup after the original key is removed; Home handoff durability; accessible recovery copies; safe fresh start; startup gating and obsolete recovery callbacks.
- Seventeen deliberate mutations failed their named guarding tests: six queue/open protections, eight native storage protections and three UI/hand-off protections. Scratch copies were restored byte-identically. All 4057 retained mutation clauses remained applicable.
- Existing creature and edition browser suites passed, including portrait/prose persistence, actual file downloads and edition baseline behavior.
- Full engine gate passed 3226 assertions and 137 existing standalone suites before registering the six new writer tests. The commit hook runs the final 138-suite registry. All browser suites also gate the push.
- Screenshots inspected: `%TEMP%/tnd-designer-drafts/quota-before.png`, `large-draft-after.png`, `failed-autosave-mobile.png`. They show the actual overflow failure, successful large save and an actionable mobile failure without horizontal overflow.
- Independent pre/post review: `/root/drift_review`. Review reproduced recovery defects before their corrections; final verification is recorded in the task row/commit.

## Existing assertions deliberately retargeted

`tests-designer-creatures.js` previously extracted the localStorage timer. Its same failure-reason/file-recovery contract now exercises the real writer and recovery UI. `tests-designer-creatures-browser.js` reads the committed IndexedDB envelope instead of localStorage and still requires exact original prose. Edition browser tests await transaction completion instead of a 450 ms timer. The #439 incoming source contract no longer requires pre-deleting the old draft: it requires atomic replacement and consuming the incoming slot only after durability; the original dirty-draft confirmation tests remain. No frozen hash was changed and no preservation assertion was weakened. The existing test-seam assertion and its mutation remain unchanged.

## Limits and rollout

Reload installs the Designer update; stored drafts migrate automatically. Save a `.blueprint` file from any currently open old tab before reloading if its autosave failed: browser-only edits that were never persisted cannot be reconstructed after the tab closes. The fix neither changes running campaigns nor removes their storage. IndexedDB can still fail due to browser restrictions or exhausted device storage; those failures keep the prior durable draft and expose retry/export recovery. No paid model calls, production storage inspection or campaign prompt changes were made.

During this work the owner also questioned portrait appearance. A free intercepted request through the real Designer, using the visible Frog-Eyed Reedjumper description, included the full humanlike-face wording and no GM-only notes or reference image. Live `designer-creatures.js` and `ui-portrait.js` bytes matched the inspected source. That verifies request inclusion, not the image model's adherence; no portrait prompting code was changed or paid quality test run.
