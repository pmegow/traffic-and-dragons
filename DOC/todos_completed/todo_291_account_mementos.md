# TODO #291 — account mementos (pushed checkpoint)

Paused 2026-09-04 at the project's unrelated-red collaboration boundary. The owner then
directed this isolated workstream to be committed and pushed as a reviewable checkpoint.
The checkpoint client is v1.810 and server package v1.3.0. The server was subsequently deployed
with owner approval on 2026-09-04 PDT in v1.4.0, after a fresh backup and migration rehearsal.
[Deployment receipt](../../audits/DEPLOY_server_v1.4.0_2026-09-04.md). The other closeout items below remain open.

## Blocker

The #292 game push (`1ad9455`, CI run 33867822007) fails the separate v1258 replay check:
`ENDSTATE DRIFT` at byte 536, expected 21,950 bytes, replayed 22,574. The identical failure
is present on Fable's preceding `e33088e` (run 33837351064) and reproduces locally with
`node dev/diff-replay.js dev/corpus_playtest_v1258.json --check`. No replay baseline or
protected drift file has been changed. Fable must adjudicate the state diff before work
continues. The ordinary `node dev/run-tests.js` gate passes; it is not the whole CI workflow.

## Implemented checkpoint

Game: `mementos.html`, `dev/tests-291-mementos.js`, `dev/run-standalone-suites.js`,
`storage-adapter.js`, `ui-files.js`, `ui-boot.js`, `home.html`, `sw.js`, and this task record.
The adapter-method and satellite-allowlist edits were explicitly owner-approved.

Server (`C:\Users\hannu\Projects\traffic-and-dragons-server`): `mementos.js`,
`test-mementos.mjs`, `db.js`, `index.js`, `package.json`, `test-hygiene.mjs`,
`.github/workflows/tests.yml`. These landed in server commit `6bd263e` (v1.3.0).

- Schema v4 adds a composite `(user_id,id)` store, independent of campaign deletion.
- GET list returns metadata and limits, never all HTML blobs. GET/PUT/DELETE scope every
  lookup/mutation to the authenticated account. Matching ids in different accounts are
  independent. The existing global session middleware gates every endpoint.
- Default limits: 4 MiB serialized UTF-8 bytes per story and 100 stories per account,
  configurable through `MEMENTO_MAX_BYTES` / `MEMENTO_MAX_COUNT`. Bytes also count against
  the existing account quota. Replacements subtract their previous bytes. Quota/count
  checks and writes share one transaction.
- File → Save / Load → Save story to account reuses `buildNarrativeHtml` without changing
  it or the transcript. Each explicit click creates a snapshot; an in-flight latch prevents
  duplicate submissions. Empty/disconnected saves and server errors are visible.
- Home links to the account's memento shelf. HTML is fetched only for the selected story,
  placed in an opaque-origin, script-disabled sandbox with a restrictive CSP first, and
  can be downloaded. Preview/list generations reject stale callbacks. Delete confirms the
  permanent removal. No file importer or additional compiler stage was added.

## Verification performed / still required

Failing tests were written first. Server `npm test`: 78 gateway + 56 hygiene + 13 memento
groups pass. The hygiene/backup expectations were advanced to schema v4 without removing
their newer-schema refusal or preservation assertions. Client
`node dev/tests-291-mementos.js`: 9 groups pass. `node dev/run-tests.js` exits 0.

Still required: rendered desktop/mobile/error and hostile-HTML preview checks, retained
client/server sabotage proofs, final review, CI/deployed-page verification, and a TODO status
closeout. Recheck both working trees before resuming: Fable works concurrently. Existing
unrelated untracked research/test fixtures were untouched.

The approved deployment found checkpoint schema v3 already live and applied migrations v4/v5.
All eight checked existing data tables retained identical row fingerprints. No production
memento was created or deleted, and no real subscription was changed as a verification step.
