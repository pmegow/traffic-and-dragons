# Operator console update — #674

Game v1.1330; server v1.13.0; database schema 13. Implemented 2026-10-30.

Player Activity starts collapsed, with a separate collapsed disclosure for each account. Headings count metered requests since the operator's previous visit, across devices. A first visit establishes a zero baseline. Refresh retains that baseline; reopening the page starts another visit. The initial request has a stable identifier, so retrying a lost response cannot consume the baseline twice. Separate operators have separate markers. Token and cost details retain their existing 30-day window. Failed reads show unavailable, never a misleading zero.

Release Notes starts with verified production deployments from v1.1326 onward. Each release shows local date, time and time zone, with each action under 25 words. Dates come from successful Cloudflare Pages checks, not commit times. Earlier history has not been reconstructed.

Every application version bump must update release-next.json in the same commit. The full test gate checks the version and bullet length. After a successful master Engine tests run, the release recorder reads the corresponding successful Cloudflare Pages check and appends release-notes.json. It refuses to invent dates and fails visibly if a receipt is unavailable. Re-run the workflow after a delayed deployment; the recorder is idempotent. The ledger-only commit does not create another application release.

Email beta testers previews the saved message and recipient list before Send. Recipients are active, unexpired Tester/Beta subscriptions with a verified email, excluding operators and merging duplicate addresses case-insensitively. The server rechecks eligibility before each delivery. Each address receives a separate message from accounts@trafficanddragons.com. Nothing is sent on preview.

Delivery receipts survive reloads and server restarts. Load recent mailings resumes pending or explicitly refused recipients without repeating accepted recipients. A simultaneous request cannot claim the same recipient twice. Unknown outcomes stop and require inspection of Cloudflare Email Logs. Provider acceptance does not guarantee inbox delivery. Drafts expire after 24 hours; bounds are 100 unique recipients, 200 subject characters and 20,000 message characters. Existing sender configuration, daily bounds and retry limits apply.

Verification: before/after desktop and 390-pixel phone renders with 30 disposable players; long and duplicate names, inert hostile text, preserved expansion, visit cursor, malformed release notes, preview/cancel/double-click/partial-email failures. Server fixtures cover nonoperator refusals, cursor isolation and retries, recipient selection, revoked access, immutable previews, concurrent sends and uncertain delivery. No production email or account mutation was used for testing.

Rollout requires server migration 13 before activity and email controls become usable. Back up and rehearse the migration, then deploy server v1.13.0; verify health and unauthorized route refusals. Publish the frontend and verify production files. The owner can then inspect real activity and choose when to send a real message. Rollback after a schema stamp requires a compatible server or restoring the pre-deploy backup; older binaries reject newer schema versions.
