# Operator console update — #674

Game v1.1330; server v1.13.0; database schema 13. Implemented 2026-10-30.

Player Activity starts collapsed, with a separate collapsed disclosure for each account. Headings count metered requests since the operator's previous visit, across devices. A first visit establishes a zero baseline. Refresh retains that baseline; reopening the page starts another visit. The initial request has a stable identifier, so retrying a lost response cannot consume the baseline twice. Separate operators have separate markers. Token and cost details retain their existing 30-day window. Failed reads show unavailable, never a misleading zero.

Release Notes starts with verified production deployments from v1.1326 onward. Each release shows local date, time and time zone, with each action under 25 words. Dates come from successful Cloudflare Pages checks, not commit times. Earlier history has not been reconstructed.

Every application version bump must update release-next.json in the same commit. The full test gate checks the version and bullet length. After a successful master Engine tests run, the release recorder reads the corresponding successful Cloudflare Pages check and appends release-notes.json. It refuses to invent dates and fails visibly if a receipt is unavailable. Re-run the workflow after a delayed deployment; the recorder is idempotent. The ledger-only commit does not create another application release.

Email beta testers previews the saved message and recipient list before Send. Recipients are active, unexpired Tester/Beta subscriptions with a verified email, excluding operators and merging duplicate addresses case-insensitively. The server rechecks eligibility before each delivery. Each address receives a separate message from accounts@trafficanddragons.com. Nothing is sent on preview.

Delivery receipts survive reloads and server restarts. Load recent mailings resumes pending or explicitly refused recipients without repeating accepted recipients. A simultaneous request cannot claim the same recipient twice. Unknown outcomes stop and require inspection of Cloudflare Email Logs. Provider acceptance does not guarantee inbox delivery. Drafts expire after 24 hours; bounds are 100 unique recipients, 200 subject characters and 20,000 message characters. Existing sender configuration, daily bounds and retry limits apply.

Verification: before/after desktop and 390-pixel phone renders with 30 disposable players; long and duplicate names, inert hostile text, preserved expansion, visit cursor, malformed release notes, preview/cancel/double-click/partial-email failures. Server fixtures cover nonoperator refusals, cursor isolation and retries, recipient selection, revoked access, immutable previews, concurrent sends and uncertain delivery. No production email or account mutation was used for testing.

Deployment completed 2026-10-30. Server v1.13.0 is Fly release 69; production schema 13, integrity_check and foreign-key checks passed. Fresh snapshot vs_9yDqwyj8AMNu7lJjlL6z preceded migration. See the [server deployment receipt](https://github.com/pmegow/traffic-and-dragons-server/blob/master/DEPLOY_1.13.0_admin_updates.md).

Frontend v1.1330 was published from merge 54c9acb385ed6fb32a1403f83c043def62878661 at 14:40:34 PDT (21:40:34 UTC). The console, two new controllers, storage adapter, globals and service worker matched production byte-for-byte after line-ending normalization. A clean browser loaded the live page, protected the operator controls and loaded release history without script errors. The release ledger uses this production timestamp, with the metadata source commit recorded separately for deduplication.

No real beta email was sent. Owner-side login/campaign load and inbox confirmation remain manual checks. Rollback requires schema-13-capable server code or the pre-migration snapshot with the prior image; older binaries reject the migrated database.
