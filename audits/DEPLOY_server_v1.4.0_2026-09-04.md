# Server v1.4.0 deployment — 2026-09-04 PDT

Owner approved reviewing, backing up and deploying the pending server release while keeping
Gemini explicit caching disabled. Deployment completed 2026-09-05 around 05:05 UTC
(2026-09-04 around 22:05 PDT). This is deployment evidence, not cache-enablement approval.

## Release and review

- Server commit: `17a52b1fd18b9d0838e4707d3de40e8ec75a8fd4`, package v1.4.0.
- Live preflight: package v1.1.0, schema 3. SHA-256 hashes of index.js, db.js, gateway.js
  and render-proxy.js matched commit `97a5ea0`; the #300 checkpoint server was already live.
- Reviewed the pending #292 operator routes, #291 memento storage, #334 gateway/cache
  integration, additive schema migrations 4/5, CORS, quotas, auth and disabled-path behavior.
  The release has no dependency changes. The checkout and GitHub master matched and were clean.
- `npm test`: 172/172 checks passed (78 gateway, 56 hygiene, 13 memento, 10 cache lifecycle,
  15 Gemini gateway). `node --check index.js` and `node --check db.js` passed.
- Game `node dev/run-tests.js`: ALL GREEN, 2,007 engine assertions; standalone batteries passed.
  This does not clear the previously recorded, separate v1258 CI replay-baseline discrepancy.

## Backups and migration rehearsal

- [Fresh off-Fly backup](https://github.com/pmegow/traffic-and-dragons-server/actions/runs/33946041516):
  successful, 6,918,144-byte SQLite copy, schema 3, integrity_check ok.
  Artifact `ashen-db-33946041516`, ID `9963354954`, retained until 2026-10-10 05:00:27 UTC.
  Uploaded ZIP SHA-256: `f59aa2f5facda2f229ed353acc71aaeeb74adec5ea700f7b7f958c2756666387`.
- [Fresh restore drill](https://github.com/pmegow/traffic-and-dragons-server/actions/runs/33946042860):
  successful at the exact release commit. Booted a disposable fresh production copy,
  applied migrations 4/5, reached health 200, verified schema 5 and integrity_check ok.
  Existing table counts and newest campaign timestamp were unchanged by the rehearsal.
- Fly snapshot `vs_KPVqpP3ey7YhZPe4Ab9J` of `vol_re15k01g06675pl4`:
  created 2026-09-05 05:00:21 UTC, status `created`, five-day retention.

## Deployment and postflight

Command: `flyctl deploy --app traffic-and-dragons-server --ha=false --remote-only --env GEMINI_EXPLICIT_CACHE=0 --wait-timeout 180s`.

- Fly release 42, machine `48ee379bd62728`, original volume and `/data/ashen.db` retained.
- Image: `registry.fly.io/traffic-and-dragons-server:deployment-01M1QZ6VJ2MJHS20ZWAXXPVN91`.
  Digest: `sha256:ef737ba8524c33bbc2ab0fdaf45aedc90d488cb538afeb7abd7d16cc8a0c0f7b`.
- Deployed package v1.4.0; checked code hashes match the release commit; schema 5;
  integrity_check ok; foreign_key_check returned zero errors.
- `GEMINI_EXPLICIT_CACHE=0` verified in both the machine configuration and process environment.
  `DEV_LOGIN_SECRET` and `LLM_UPSTREAM_BASE` remain absent. Zero cache handles/events exist;
  the memento table starts empty. No paid model calls were made by this deployment check.
- Public `/health`: 200, status ok. Unauthenticated `/api/account`, `/api/mementos`,
  `/api/admin/users` and `/api/admin/stats`: 401. Gemini CORS preflight: 204, explicitly
  permits Authorization, Content-Type, X-TND-Kind and X-TND-Cache.
- Read-only, ordered whole-row JSON fingerprints matched exactly before/after deployment for
  users (2), campaigns (5), characters (13), blueprints (5), subscriptions (2), checkpoints (1),
  identities (2), and prefs (1). This checks stored content, not merely row counts.
  Sessions and usage are not covered by that fingerprint comparison.

## Still pending

- Owner subsequently confirmed hard refresh preserved the turn and a couple of ordinary
  account-mode turns worked. A fresh OAuth login was not separately exercised. No production
  subscription changes or test mementos were made.
- #291 retains its unfinished rendered/hostile-HTML/sabotage/CI closeout items. #292 still needs
  the deployed console readout check; do not mutate a real subscription as a smoke test.
- #334 remains disabled. Actual vendor cache acceptance, reuse, expiry recovery, drift/secret
  obedience and total generation-plus-storage costs need isolated live verification before
  separate enablement approval. Header support is not an indication that caching is enabled.
  The first isolated attempt found a countTokens request-shape defect before any cache or
  generation was created. A subsequent v1.4.1 fix passed isolated 3.7-flash creation/reuse/state
  checks, with cleanup verified separately after the strict probe received 403 rather than
  404. **That fix has not been deployed**; this release remains v1.4.0 with caching off.
  [Failure and follow-up receipts](PROBE_334_cache_creation_2026-09-04.md).
- Roll forward on schema 5. Do not deploy the old schema-3 reader against the migrated volume;
  a database restore is a separate recovery operation, not an automatic rollback.
