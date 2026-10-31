# Editable invitation preview — #676

Implementation version 1.0. App v1.1332; server v1.15.0; schema 15.

The owner confirmed the original invitation worked, then reported that the fixed email went out before its text could be seen or personalized. The original form confirmed only recipient/access details and called Send directly.

The console now follows Compose → Preview → Send. Subject and personal message are editable. Preview shows the recipient, subject and complete plain-text email, including Google/Gmail instructions and access terms. Only the secure link is a labeled placeholder, generated on Send. Its expiry is described as seven days after sending, so the reviewed wording matches delivery exactly. The link, instructions and access terms are appended by the server and cannot be removed by editing the personal message.

Preview is read-only: no invitation, email, revocation, subscription or token is created. Editing any field invalidates the preview and disables Send. The server also requires a content hash matching the preview, so old console versions and stale previews fail visibly instead of sending. This is a content-consistency check; operator authentication remains the authorization boundary. Final Send retains the existing confirmation and stable request-id deduplication.

Resend opens the composer with the saved subject/message and fixed original recipient/access terms. The existing invitation remains valid while composing or previewing. Only final Send rotates its link and sends the replacement. History shows the saved personal copy with delivery receipts. Accepted invitations still cannot be resent.

Schema 15 adds nullable subject/message columns to invitations. Existing records, accepted links and sessions remain intact. Legacy messages use their original standard introduction when composing a resend. Subjects allow 1–200 characters without header newlines; messages allow 1–10,000 characters and preserve paragraph breaks. The shared server renderer supplies both preview and delivery; the browser never constructs the security footer.

Verification covers zero effects on preview, custom copy, exact preview/delivery parity apart from the generated link, missing/stale previews, reused request ids, header injection, resend timing and migration of an accepted schema-14 record. Browser checks cover edit invalidation, explicit sends, escaped text, saved copy, visible failures and desktop/phone layout. No real email is used in automated tests.

Deployment pending: full gates, additive migration rehearsal and fresh snapshot before server deployment, then frontend publication and production release-date recording.
