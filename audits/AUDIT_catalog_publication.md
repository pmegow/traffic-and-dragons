# Catalog publication verification — 2026-09-25

App v1.999, designer v0.48; server v1.6.0 (`9427fcb`, schema 6).

## Cause and change

The old designer Publish saved `/api/blueprints`, a private account copy. Catalog cards independently read static sample metadata, including the old author, and the service worker could keep old samples. Publishing a private copy could never update that catalog.

Save to My Library now describes that personal action. Admin-only Publish to Catalog updates a separate durable catalog through the server. The dialog identifies the entry being replaced, its spoiler-free description, and whether it has an author byline. The server checks admin access and expected revision, preserves order on replacement, and appends new entries. Both catalog views fetch this same source without caching. Home refreshes on return to the tab. Sample downloads are network-first with an offline fallback.

## Evidence

- Test-first designer label repro failed on the old Publish wording. New server integration fixture initially failed because the catalog endpoint did not exist.
- Server `npm test`: all suites passed, including eight new catalog integration checks. The author-removal case starts with an actual OLD BYLINE, clears it through HTTP publication, and verifies the persisted blank after restart. Personal copies, ordering and stale-revision refusal are covered.
- Full app gate: 2,327 engine assertions plus standalone suites pass.
- `dev/tests-blueprint-catalog-browser.js`: eight entries; default catalog; safe previews; selection; personal library; signed-out/file import; failures/retry; stale responses; mobile.
- `dev/tests-blueprint-publish-browser.js`: real designer controls and adapter with intercepted fixture HTTP. Personal save does not publish; admin publication sends a blank author; an already-open home page refreshes; game catalog shows the same publication and refetches on reopen; conflicts preserve the dialog/draft; non-admin button is hidden. Stable catalog id survives designer export.
- `dev/tests-blueprint-catalog-cache.js`: the real worker receives a stale cached sample and newer network content; online uses the newer response, offline retains fallback, Fly catalog requests bypass the worker. Included in the standard standalone gate.
- Six attributed mutation clauses passed across `dev/sabotage-blueprint-publish.js` and `dev/sabotage-blueprint-catalog.js`: restoring an old byline; removing sample network-first; wrong default tab; exposed spoilers; stale library response; unintended personal write.
- Chrome desktop and 390px mobile screenshots inspected; publication dialog fits and displays the no-byline preview. Screenshots generated under the system temporary `tnd-blueprint-catalog-tests` folder.

## Migration precautions

Fly volume snapshot `vs_e548p5bn3BNSQvBYyl1L` completed at 2026-09-25 15:28:51 UTC before deployment (five-day retention). No off-server backup was triggered: automatic approval review rejected a proposed GitHub artifact export; the accepted alternative stayed within the existing Fly provider. Schema 6 seeds eight original campaigns exactly once, with Riverlight first and Silence's author blank. No production private-library edits or model calls are needed. Do not roll back to a schema-5-only server.
