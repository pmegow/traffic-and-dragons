# Render all missing Designer portraits (#732)

Designer v0.72; engine version unchanged under the Designer-only version rule.

The page already had a registry and a shared portrait renderer, but only card-level controls could invoke it. File now exposes **Render all missing portraits** for both creatures and NPCs. A focused Designer-only coordinator takes a snapshot from that registry and invokes the existing image transport and prompt builders one at a time. It does not regenerate existing images or change prompt wording/model defaults.

Each result follows the existing compressed, embedded portrait and autosave path. The shared worker returns a structured saved/skipped/failed outcome, allowing the batch to report failures by entry without losing successful work. Its missing-only mode checks the image again after the request; the original blueprint, membership and text-identity checks still apply. Queue entries are checked before spending as well. The File item changes into Stop rendering missing portraits; Stop lets the current image finish and prevents subsequent requests. Switching blueprints also stops the queue and refuses any late attachment.

## Verification

- Failure first: the actual browser page failed `File menu exposes missing portraits on desktop and phone` with `Render all missing portraits action missing (0 !== 1)`. The absent action was captured before implementation.
- Nine actual-browser groups cover the File route and phone fit; mixed existing/missing NPCs and creatures; selected model and existing prompt guidance; serial requests; embedded portrait bytes and draft reopen; no-op/retry; elapsed progress and Stop; attributed provider failures while subsequent entries succeed; queue edits/removal; late images; replacement blueprints; empty/invalid/busy entries and unavailable image access.
- Existing creature unit, outgoing portrait browser and File menu browser suites pass without changing any previous assertion. No frozen hashes were rebaselined.
- Desktop, phone and running-progress screenshots were visually inspected. The menu item fits the phone viewport and the running item offers Stop.
- Browser provider responses are intercepted before the paid boundary. No paid image generation is necessary for this menu/queue change; existing production rendering transport and prompt builders are reused.
- The initial mark-dirty mutation passed the image-persistence assertion: render() independently schedules a save, so removing markDirty alone does not break persistence. The fixture now finishes its load save before the batch and checks the retained dirty flag as well. A separate mutation suppresses saveDraft during the batch to prove actual portrait durability. Both initially missed runs are recorded; no existing assertion was weakened.
- All 14 new deliberate mutations were caught by their named tests, including separate autosave and dirty-flag failures; all 16 existing #508 creature/portrait mutations were re-proven. Files were restored byte-identically. The dry applicability check passed all 4,115 clauses across 407 batteries.
- The first full commit gate rejected the new mutation battery because its required `dev/cdp-browser.js` marker was absent. The Chrome lookup and explicit skip already existed; the marker was added without changing the assertion or skip behavior.
- The new browser suite is registered in CI and is automatically included in the pre-push browser gate. Full engine/standalone and browser gates remain mandatory at commit/push, followed by a live version, asset-byte and actual-menu check.

The resource pass finds one bounded snapshot of the entries selected at click time, one active batch reference and one elapsed timer. The batch runs serially, releases its references on completion and stops its timer in `finally`; no new persistent store, listener-per-render or retained queue is introduced. Existing drafts need no migration. Refresh the Designer to use the action.
