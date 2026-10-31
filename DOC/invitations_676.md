# Editable invitation preview — #676

Implementation version 1.0. App v1.1332; server v1.15.0; schema 15.

The owner confirmed the original invitation worked, then reported that the fixed email went out before its text could be seen or personalized. The original form confirmed only recipient/access details and called Send directly.

The console now follows Compose → Preview → Send. Subject and personal message are editable. Preview shows the recipient, subject and complete plain-text email, including Google/Gmail instructions and access terms. Only the secure link is a labeled placeholder, generated on Send. Its expiry is described as seven days after sending, so the reviewed wording matches delivery exactly. The link, instructions and access terms are appended by the server and cannot be removed by editing the personal message.

Preview is read-only: no invitation, email, revocation, subscription or token is created. Editing any field invalidates the preview and disables Send. The server also requires a content hash matching the preview, so old console versions and stale previews fail visibly instead of sending. This is a content-consistency check; operator authentication remains the authorization boundary. Final Send retains the existing confirmation and stable request-id deduplication.

Resend opens the composer with the saved subject/message and fixed original recipient/access terms. The existing invitation remains valid while composing or previewing. Only final Send rotates its link and sends the replacement. History shows the saved personal copy with delivery receipts. Accepted invitations still cannot be resent.

Schema 15 adds nullable subject/message columns to invitations. Existing records, accepted links and sessions remain intact. Legacy messages use their original standard introduction when composing a resend. Subjects allow 1–200 characters without header newlines; messages allow 1–10,000 characters and preserve paragraph breaks. The shared server renderer supplies both preview and delivery; the browser never constructs the security footer.

Verification covers zero effects on preview, custom copy, exact preview/delivery parity apart from the generated link, missing/stale previews, reused request ids, header injection, resend timing and migration of an accepted schema-14 record. Browser checks cover edit invalidation, explicit sends, escaped text, saved copy, visible failures and desktop/phone layout. No real email is used in automated tests.

## Production receipt

Published as app v1.1332 on 2026-10-31T04:52:26Z (October 30, 21:52:26 PDT). PR #19 merged as 2d1aa6e5e5f28d657cdb60a935d30857f4b04c25; feature source eecbc9e0ae5236b7e4985bb75804bc9caec7d1fd. The timestamp comes from the successful production Cloudflare check and is recorded in release-notes.json.

Server v1.15.0 deployed as Fly release 71 at 04:51 UTC, source 249185efacb669efb4f38cb5141621d43ad154f0. Fresh snapshot vs_DByjGB4X1mMhbzKQ1aM was created at 04:47:03 UTC with five-day retention after the successful backup rehearsal. Read-only production checks confirmed schema 15, integrity_check=ok, no foreign-key violations and the subject/message columns. GEMINI_EXPLICIT_CACHE stayed 1. Anonymous preview/send requests returned 401.

Verification passed the full local gate (3,196 engine assertions and 129 standalone suites), all 23 browser suites, the complete server npm test suite, seven composer/API/migration checks, six server composer mutation proofs and four browser composer proofs. Existing invitation/OAuth checks and their mutation proofs also passed. Desktop and phone screenshots were inspected. The old form was reproduced with fake transport to confirm it sent directly without editable copy.

All six changed public console/version assets matched the tested source after publication; a clean phone browser loaded with the operator console protected, composer controls present and no page exceptions. No real email or account was created during verification. A personalized real-inbox send remains an owner check.

Publication followed green local gates and server CI under the repository's independent deployment workflow; frontend CI was still running at publication. Results: [branch CI](https://github.com/pmegow/traffic-and-dragons/actions/runs/41169538544), [PR CI](https://github.com/pmegow/traffic-and-dragons/actions/runs/41169575243), [server CI](https://github.com/pmegow/traffic-and-dragons-server/actions/runs/41169163358), [backup rehearsal](https://github.com/pmegow/traffic-and-dragons-server/actions/runs/41169211463).
