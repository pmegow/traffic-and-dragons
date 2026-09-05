# TODO #292 — operator console

Built 2026-09-04 as game v1.809; server commit `689d726` (package 1.2.0).
The server was deployed with owner approval on 2026-09-04 PDT as part of v1.4.0.
The checkpoint migration was already live; migrations 4/5 passed a fresh restore drill before
deployment. Existing account data fingerprints are unchanged. [Deployment receipt](../../audits/DEPLOY_server_v1.4.0_2026-09-04.md).

## Behavior and boundaries

- `admin_console.html`, reached through File → Settings → Operator console, is a dev-only
  satellite on the shared palette and SW network-first path. No campaign state is written.
- Every server admin route shares a real `ADMIN_USER_IDS` gate in `admin.js`, behind the
  existing session middleware. `/api/account` derives `isAdmin` from the same helper.
- Grant explicitly replaces the tier/expiry from today. Extend keeps the existing tier and
  adds time to the later of an active expiry and today. The old endpoint's implicit
  "extend" reset expiry from today and could discard remaining access. Revoke removes only
  the selected subscription. Every UI action is confirmed; duplicate in-flight clicks and
  automatic retries are excluded. Legacy `tier:"none"` calls remain compatible.
- The roster scans `usage_events` once, grouped by user/provider/model. Last-active means
  last metered request, not login. Thirty-day token buckets remain separate for pricing.
  USD is an estimate using the existing `MODEL_PRICING`, not an invoice; unpriced/image
  models are called out. OpenAI/Gemini cached input retains the existing upper-bound caveat.
- `/api/admin/stats` supplies the tier registry and 24-hour recorded upstream error count.
  Local refusals, transport failures and billing refusals are excluded and labeled as such.
- Bugs link to the existing `bug_tracker.html`; no feed or secret handling is duplicated.
- Auth, malformed/unknown-target/duration errors, and failed refreshes are visible. A
  generation check prevents an old health response from overwriting a newer refresh.

## Verification

- Failing-first server checks exposed the original expiry-reset and validation gaps.
  `node test-gateway.mjs`: 78/78; `node test-hygiene.mjs`: 56/56, disposable DBs only.
- `node dev/tests-292-admin-console.js`: 11/11; registered in the full gate.
- `node dev/run-tests.js`: ALL GREEN, 1,977 engine assertions and 26 standalone suites.
- `node dev/sabotage-292-admin-console.js`: 11/11 attributed mutations caught.
- `node dev/server-proofs/292-admin.js <server-checkout>`: 7/7 attributed mutations caught;
  source copies only, no live-tree mutation or production DB/credentials copied.
  This external-checkout launcher is separate from the game's repo-local applicability scan
  (server sources are absent from game CI); the server's own CI runs its behavioral tests.
- Rendered signed-out state, populated roster at desktop and 390px, long hostile-looking
  names, and expired-session error inspected in the browser. Fixture command:
  `node dev/preview-292-admin-console.js`; port 8124; `?mode=error`, `nonadmin`, `signedout`.
  This fixture replaces the adapter and cannot mutate real accounts.

## Remaining release check

After the backed-up server deployment, verify the console against the
deployed server and Pages build. Do not use real Grant/Extend/Revoke as an unapproved smoke
test; their mutation paths have already been exercised with disposable test accounts.
