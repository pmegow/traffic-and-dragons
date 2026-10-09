# #589 deployment and isolated server evidence

Verified 2026-10-08, America/Los_Angeles (UTC receipts in JSON). This records public deployed-code identity and synthetic local tests, not authenticated production behavior.

- Server test-library-slug.mjs: **7 passed, 0 failed**. Creates a temporary isolated SQLite database; dev-login is local only, dedicated dev_local identity. Covers punctuation new-save slug, free-target migration, occupied-target preservation/logging, two long blueprint names targeting one free slug, stamped second boot, and a rerun of migration over already migrated rows.
- Client dev/tests-481-f5-library-slug.js: **4 passed, 0 failed**. Both punctuation/accent repro names, 120-character blueprint rule, client delegation/load order, vendored SHA pin.
- Existing client sabotage battery: **4/4 caught**, named catcher attribution; each source restored byte-identical. Scratch-clone proof only.
- Public Fly /health: **200**, version **1.7.3**. GET woke the ordinary auto-stopped deployment. No machine/config change was made.

## Deployed server identity

Read-only SSH to machine 48ee379bd62728 ran Node fs.readFileSync plus crypto SHA-256 against exactly five /app code/package files. No .env, secrets, process environment or database was read. After CRLF→LF normalization, all five match local server sources:

| File | SHA-256 |
|---|---|
| library-slug.cjs | 4d02b9b6a528903f58771ad101a36c0b6d627f0306324c28adc78afde2afd872 |
| index.js | 250749645dde4bbffb6d9f9f9a9f4a5b7d0f6b8215be642f942a8220ee60089a |
| db.js | 92c99ce4c6fda262e5ac749ab353f0c5c04c77884817ac6496354f619de10286 |
| package.json | bf3aa615bbd0e365b275c8013b56f0d06f036a2d3e2e42f902032a0b3779ba11 |
| package-lock.json | 45fa713aa99cf0a00e95c717765588a520f2b8bea46b44a4cbc1bae07be40235 |

Full index identity includes session/auth middleware (index.js:183–191), dev-login implementation (:452), character list/save/slug routes (:719–783); full db identity includes shared slug import and v7 migration (:262–281). This establishes that the relevant deployed implementations equal those exercised locally. It does not inspect current production rows/schema or installed dependency binaries. Local Node is v22.17.0; deployed Node v22.23.3.

## Public client identity and bounded differences

GETs from https://traffic-and-dragons.pages.dev returned 200. Deployed globals report **v1.1193**, local **v1.1194**. library-slug.js and index.html match fully. helpers.js, ui-browsers.js, storage-adapter.js, game.js, globals.js and sw.js differ; complete public diffs are saved. Differences are the newly landed #599 version gate and markers, including portableSheet's sheetVer stamp and library adopter prechecks. Therefore the whole client is not reported identical.

Four relevant blocks match byte-for-byte (LF normalized), independently hashed in relevant-block-equivalence.json:

1. helpers.js partyUploadSlug + partyUploadPlan.
2. helpers.js libUpdateDiff + libUpdateApply.
3. ui-browsers.js _charLibSlug through all export/overwrite/Update/Replace library modals (16,510 bytes), ending before _renderCompanionSlots.
4. storage-adapter.js character list/save/delete API functions.

The shared slug file also equals the server's vendored file and both pinned test hashes. Parent separately owns the actual browser modal + local-server test. This evidence supports combining that synthetic end-to-end exercise with deployment identity, subject to the version-gate differences above; it is not an authenticated live-account test.

## Evidence and reproducibility

- deployment-equivalence.json: full server/client hashes, public URLs/statuses, version markers and first different lines.
- server-deployed-hashes.log, server-public-health.json: raw public receipts.
- server-slug-tests.log, client-slug-tests.log, client-slug-sabotage.log: exact test output.
- relevant-block-equivalence.json and compare-relevant-blocks.cjs: bounded matching source slices.
- compare-deployment.cjs, deployed-*.js, diff-*.js.txt: public download comparison inputs and all differences.

No runtime changes, server repository edits, tracker edits or commits. No production writes or authentication creation. No production dev-login enabled. One comparison-harness attempt used a nonexistent end marker and failed before producing a comparison; corrected to the observed // B3 marker and all four block comparisons passed. No source assertions or hashes were weakened.
