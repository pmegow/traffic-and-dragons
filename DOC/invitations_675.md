# Gmail invitations — #675

Implementation version: 1.0. App v1.1331; server v1.14.0; schema 14.

Send Invitation is an operator-only collapsible frame. Enter one Gmail address, choose Tester or Beta, and choose 1–3650 days (default Tester / 30). Confirming Send creates preapproval and sends an individual email through the existing server mail service. No account or subscription is created until the recipient signs in and accepts.

The email opens invitation.html with a 256-bit random secret in the URL fragment. GET requests, link previews and page load cannot consume it. Only the token hash is stored. Accept with Google opens the existing OAuth flow and posts the token using its authenticated session. The server requires Google-authenticated, strictly verified Gmail claims on that session; old sessions and GitHub sessions cannot qualify through saved contact data. Gmail dots and plus aliases resolve to the same mailbox. Other providers and Google Workspace domains are refused. Google subject identity remains the account key; email never merges accounts.

Acceptance and access grant are one SQLite transaction. The exact seven-day boundary is expired. The same account can retry a lost acceptance response without extending access; another account cannot reuse it. Existing active access retains its tier and expiry. Linked Google identities grant the existing game account. An invited sign-in skips the ordinary awaiting-approval operator email; ordinary signups retain it.

History separates Pending / Accepted / Expired / Revoked from email delivery. Resend creates a fresh seven-day invitation and invalidates its predecessor, with a new secret; the previous receipt remains. Accepted invitations cannot be resent or revoked (manage account access instead). A stable request id makes a repeated send safe. Ambiguous transport outcomes remain visible and are never automatically retried. The operator can explicitly resend after reviewing delivery. At most 100 invitations can be created per 24 hours; history shows the latest 100. Provider acceptance is not proof of inbox delivery.

Verification: disposable SQLite tests exercise authorization, malicious domains, aliases, absent/unverified Google claims, wrong account, expiration boundary, revocation, concurrent creation/acceptance, send retries, token rotation, existing access and email failures. A local OAuth stub drives the real callback, linked identity, migration from schema 13 and legacy sessions. Browser checks drive confirmation, double clicks, wrong-account refusal, recovery and phone layout; network requests are fixtures. Mutation proofs must name the guarding test. Screenshots live under ignored testRuns/invitations-675/.

Local gates passed: 3196 engine assertions, 129 standalone suites, the complete server suite, 22 invitation server checks, five client mutation proofs and twelve server mutation proofs. The browser fixture includes the 390-pixel phone and desktop views.

Rollout: run full server and frontend gates, rehearse migration against a fresh backup, snapshot the Fly volume, deploy schema-14-capable server, then publish the frontend and record the confirmed production deployment. No real invitation has been sent by automated verification. A real Gmail inbox and consent-screen acceptance remain the owner's manual check.

Rollback: schema 14 is additive, but old servers reject a newer database stamp. Prefer a forward fix or a schema-14-compatible rollback. Restoring an older snapshot loses subsequent writes and requires a separate decision.
