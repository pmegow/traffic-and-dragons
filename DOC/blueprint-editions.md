# Blueprint editions

Every newly authored blueprint starts with string `version: "0.01"` and `releaseStatus: "draft"`. Status values are `draft`, `release-candidate`, and `released`. Selecting Release Candidate promotes a pre-1.0 draft to **1.0**. Selecting Released is an explicit author decision, available after saving that content as a candidate. 1.0 alone never means Released.

The designer advances the integer revision after a saved edition's content changes: 0.09 → 0.10; 0.99 → 0.100; 1.0 → 1.01. Repeated saves and exports of unchanged content retain the version. Promoting an unchanged candidate to Released retains its version. Editing released content creates the next candidate. Versions are strings, never floating-point numbers.

The last successful save baseline persists with the browser draft. Viewing, autosaving, failed saves, editor folding, review annotations, and provenance stamps do not mint editions. Overlapping saves are refused while a cloud write is pending. A late response cannot mark later edits saved or stamp a replacement blueprint. A download counts as saved when the browser accepts the download action.

Publishing shows the edition before confirmation. If the catalog already holds newer content, publishing advances beyond its version. The server independently rejects regressing versions and changed content submitted under an existing version. Catalog `revision` remains a separate concurrency counter. Personal library copies remain independent of catalog publication.

Legacy blueprint reads adopt v0.01 Draft if both fields are missing. A valid legacy version of 1.0 or higher without a status adopts Release Candidate; it never infers Released. These defaults are written on the next save. The eight bundled originals carry explicit metadata; Riverlight retains v1.0 Release Candidate. Their story content is unchanged by this migration.

Campaign creation copies `{version, releaseStatus}` into `worldState.blueprintEdition`. Save/restore preserves it. The Quest Journal shows that starting edition; later catalog publications do not relabel existing campaigns. Older campaigns without this record say “Version not recorded.” Exporting a played campaign creates a new v0.01 Draft, since its content has evolved during play.

`blueprint-edition.js` owns parsing, labels, content identity, revision planning, and publication checks. The server vendors the same bytes as `blueprint-edition.cjs`; update both together. Empty normalization defaults and the default adventure kind are not story changes; authored class restrictions remain significant.

Verification: `node dev/run-tests.js`; `node dev/tests-blueprint-editions-browser.js` with PLAYWRIGHT_PATH configured; server `npm test`. Browser tests use intercepted fixtures, with no live publication or model calls.
