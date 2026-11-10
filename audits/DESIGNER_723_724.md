# Blueprint Designer: habitats, act selection, and author assistance

## #723 — creature generation and encounter selection

Root cause: the generator had no habitat input; a single unlock act cannot express Act I and III while excluding II. Authoring reorder/delete paths treated numeric references as positions, so they could point at a different story act.

- Optional `environment` is descriptive habitat guidance; it is not a per-location prompt filter.
- Optional `availableActs` is an exact whitelist. Absent is unrestricted; [] is disabled. Existing `revealAct` retains its available-from behavior. Both fields together, invalid numbers and duplicate acts are refused.
- Checkboxes default to every authored act. Legacy gates display their existing tail without migrating on render. Manual edits replace the legacy gate. Explicit All is unrestricted; structural edits preserve restriction intent even when deleting acts leaves every remaining box checked. New acts enable only unrestricted creatures.
- Act reorder/delete follows object identity and remaps creature selections, NPC secrets and numeric plot armor. Referenced NPC act deletion is refused atomically, including whitespace-padded numeric armor.
- **Intentional cache contract extension:** exact selections follow all active acts, or the highest completed act if no act is active. They may update stable BESTIARY at act opening **or completion**, never during ordinary turns/location/combat changes. This resolves the real executor transition with two active acts where completion need not open a new act. Legacy gates are unchanged.

Independent Astra pre-review chose this policy. Post-review found restriction widening after deletion, padded-armor remapping, and contradictory no-act generation instructions. Each was reproduced with a failing assertion, fixed and re-reviewed. Whitelist-only private notes also retain the explicit GM-only label.

Proof (local ignored artifacts under `testRuns/designer-723-724`): failure-first engine (initially 4 failures), generator, act-control and real-browser checks; review regression failures preserved. Engine coverage exercises I/III selection, multiple active acts through actual ARC_COMPLETE/ACT_COMPLETE, final coda, malformed/empty selections, save/import, public/private formatting and stable bytes. Seven act-control and 23 creature-helper checks cover references, defaults, preservation and late response rejection. Browser fixture confirms Forest + I/III through generation, text edits, save/reload, portraits and phone layout. Original and updated screenshots are under `%TEMP%/tnd-creature-designer`.

Before/after `dev/capture-prompt.js` on the untouched Silence t7 save and reconstructed v1.01 opening: **no changed hunks in either half**. SHA prefixes: t7 stable `4eaa1d72b0ae`, volatile `4a3212fda7c2`; opening stable `e354973ffe78`, volatile `ca2a7fac74a7`. Existing campaigns without the optional fields are byte-compatible and need no restart.

No frozen hash or golden baseline was changed. The old numeric creature editor source assertion was replaced with the requested checkbox-editor assertion, retaining typed legacy setter tests and adding behavioral coverage. The #508 stale-draft sabotage anchor was retargeted to the strengthened full-context stamp without changing its expected failure. A first cache sabotage survived because the fixture had only an eligible creature; adding an ineligible creature exposed the failure and made the guard meaningful. One mutation attribution typo was corrected.

No paid model/image calls, account writes, or catalog content changes. TnD_Maps was not touched.

## #724 — AI assistant

The old Ask/Consult window could only advise; it could not propose edits or retain a safe request lifetime. It also kept an unbounded conversation array and updated the last array entry after await, even if the modal was closed.

The assistant now accepts an author request and returns advice or a detached, validated proposal. A preview shows each changed item before and after, including normalized values and implicit custom-class availability changes. Apply rechecks the source object and durable blueprint fingerprint and rebuilds a fresh candidate, preserving current view/review/edition metadata. Existing class restrictions gain requested new classes; renames/deletions update that roster atomically. The assistant edits act fields and arcs; structural act changes remain with the act controls.

Typed item schemas, explicit add/update/delete actions, canonical unique targets and exact rule text prevent accidental upserts or ambiguous writes. Optional fields and portraits survive partial updates. Conflicting creature gates, invalid custom classes, unknown fields and new overlong prose are refused as a whole. Provider finish metadata rejects even parseable truncated replies. A request sends the text-only current blueprint, optional selected review finding and at most one previous question/reply. It sends no portraits, review history or game conversation. The output ceiling is 16,000 tokens; input request 4,000 characters, reply 12,000, response 200,000, proposal 40 items. One modal owns one active request/proposal and ticker; closing invalidates callbacks and releases its retained state. No additional device/session/campaign history accumulates.

Independent Astra review reproduced five defects beyond the initial green tests: padded target mismatch, conflicting gates erasing restrictions, wrong field types, normalized preview mismatch, and incomplete length checks. Four failure-first groups now exercise all five, and the reviewer independently passed all 16 unit groups plus the browser suite after the fixes.

The browser exercises advice, five forest plus five swamp soldiers, before/after preview, explicit Apply, custom classes, stale Apply, double-apply prevention, escaped model markup, phone layout, ticking waits, close/reopen races and visible provider errors. It asserts zero account/catalog writes. Images were inspected on desktop and phone. A fixture stylesheet MIME mistake initially produced an unstyled screenshot despite behavioral passes; corrected and guarded by a computed-theme assertion, then rendered again. One attempted late-success UI mutation survived because the service layer already rejected it; the battery now independently breaks the late-error UI guard and proves the reopened modal stays neutral. All 18 attributed clauses pass; no assertion or frozen hash was weakened/rebaselined.

Designer-only version carve-out in CLAUDE.md applies: v0.65, engine remains v1.1393 / CACHE tnd-v3-20261110f. No engine behavior changes in this commit. No paid model or image tests were run; creative quality of a live response remains unverified. Blueprint proposals update the local draft only on Apply, followed by its existing local autosave. Library saving/catalog publication remain explicit user actions. Existing campaigns retain their saved blueprint content; designer edits affect campaigns subsequently created from the edited blueprint.

The first #724 commit gate refused the new browser sabotage battery because it lacked the required explicit no-Chrome skip verdict (`tests-252-retained-proof-wiring`). Added the standard locateChrome/announced-SKIP path without changing the guard; CI retains the new browser screenshots on failure.
